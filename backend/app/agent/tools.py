"""Deterministic database retrieval tools for the Empório da Música AI Agent.

Implements safe, parametrized queries for:
- Product searches (by name, category, status, specs)
- Active promotion queries
- Customer order and order-item lookups (strictly bound to authenticated user's customer_id)
- Knowledge base hybrid RAG retrieval
- Human support ticket escalation
"""

from datetime import date
from decimal import Decimal
import json
import logging
from typing import Any
import unicodedata
import uuid

from langchain_core.tools import tool
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.retrieval import HybridRetriever
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import Category, Product
from app.models.promotion import Promotion
from app.models.support import SupportTicket
from app.models.user import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Input Schemas
# ---------------------------------------------------------------------------

class SearchProductsInput(BaseModel):
    query: str | None = Field(
        default=None,
        description="Termo de busca para pesquisar no nome ou descrição do instrumento/produto (ex: 'violão', 'yamaha', 'teclado', 'tagima').",
    )
    category_name: str | None = Field(
        default=None,
        description=(
            "Nome exato da categoria para filtrar produtos. Use somente quando o cliente "
            "especificar explicitamente uma categoria. Deixe nulo se houver dúvida. "
            "Categorias disponíveis: 'Guitarras', 'Baixos', 'Baterias e Percussão', "
            "'Teclados e Pianos', 'Violões', 'Instrumentos de Sopro (Madeiras)', "
            "'Instrumentos de Sopro (Metais)', 'Cordas Orquestrais', 'Ukuleles'."
        ),
    )
    max_price: float | None = Field(
        default=None,
        description="Preço máximo em reais (BRL) para filtrar os produtos.",
    )
    limit: int = Field(
        default=6,
        ge=1,
        le=15,
        description="Quantidade máxima de produtos a retornar.",
    )


class SearchPromotionsInput(BaseModel):
    category_name: str | None = Field(
        default=None,
        description="Filtrar promoções para uma categoria específica de produto.",
    )
    only_active: bool = Field(
        default=True,
        description="Se verdadeiro, lista apenas promoções ativas no momento.",
    )


class GetCustomerOrdersInput(BaseModel):
    order_id: int | None = Field(
        default=None,
        description="ID específico do pedido a consultar (opcional). Se não fornecido, lista os pedidos recentes do cliente.",
    )


class SearchKnowledgeBaseInput(BaseModel):
    query: str = Field(
        ...,
        min_length=2,
        description="Pergunta ou dúvida sobre políticas da loja, prazos de entrega, garantia, formas de pagamento, trocas ou devoluções.",
    )
    limit: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Quantidade de trechos da política da loja a recuperar.",
    )


class EscalateToHumanSupportInput(BaseModel):
    reason: str = Field(
        ...,
        min_length=5,
        description="Motivo do encaminhamento para atendimento humano (ex: 'Solicitação de cancelamento com estorno', 'Reclamação de avaria no transporte', 'Dúvida que exige intervenção administrativa').",
    )


# ---------------------------------------------------------------------------
# Tool Factory & Implementations
# ---------------------------------------------------------------------------

def create_agent_tools(db: Session, current_user: User, conversation_id: uuid.UUID):
    """Creates context-bound tools for the agent run.

    Authentication security is enforced here:
    `current_user` and `db` are passed from the verified backend session,
    never trusted from user prompts or LLM arguments.
    """

    @tool("search_products", args_schema=SearchProductsInput)
    def search_products(
        query: str | None = None,
        category_name: str | None = None,
        max_price: float | None = None,
        limit: int = 6,
    ) -> str:
        """Busca instrumentos e produtos musicais no catálogo do PostgreSQL da Empório da Música.
        Permite buscar por nome, categoria ou faixa de preço. Retorna preço em BRL, estoque e características.
        """
        def _normalize(txt: str) -> str:
            decomposed = unicodedata.normalize("NFD", txt)
            stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
            return stripped.lower()

        def _variants(word: str) -> set[str]:
            res = {word}
            if word.endswith("s") and len(word) > 3:
                res.add(word[:-1])
            if word.endswith("es") and len(word) > 4:
                res.add(word[:-2])
            if word.endswith("oes") and len(word) > 4:
                res.add(word[:-3] + "ao")
            if word.endswith("ao") and len(word) > 3:
                res.add(word[:-2] + "oes")
                res.add(word[:-2] + "aos")
            return res

        stmt = (
            select(Product)
            .join(Category, Category.category_id == Product.category_id)
            .where(Product.status == "active")
        )

        if category_name:
            stmt = stmt.where(Category.name.ilike(f"%{category_name.strip()}%"))

        if max_price is not None:
            stmt = stmt.where(Product.price_brl <= Decimal(str(max_price)))

        candidates = db.execute(stmt).scalars().all()

        if not candidates:
            return json.dumps(
                {
                    "message": "Nenhum produto encontrado com os critérios fornecidos.",
                    "total_found": 0,
                    "products": [],
                },
                ensure_ascii=False,
            )

        if query and query.strip():
            raw_terms = query.strip().split()
            norm_terms = [_normalize(w) for w in raw_terms if _normalize(w)]
            term_variants = [_variants(t) for t in norm_terms]

            scored: list[tuple[int, int, Decimal, Product]] = []
            for p in candidates:
                p_name = _normalize(p.name)
                p_cat = _normalize(p.category.name if p.category else "")
                p_desc = _normalize(p.description or "")

                matches = 0
                score = 0
                for vset in term_variants:
                    in_name = any(v in p_name for v in vset)
                    in_cat = any(v in p_cat for v in vset)
                    in_desc = any(v in p_desc for v in vset)

                    if in_name or in_cat or in_desc:
                        matches += 1
                        if in_name:
                            score += 10
                        if in_cat:
                            score += 6
                        if in_desc:
                            score += 1

                # If multiple terms are queried, eliminate spurious single-term matches
                min_matches = 2 if len(norm_terms) > 1 else 1
                if matches >= min_matches:
                    scored.append((matches, score, p.price_brl, p))

            # Rank primarily by number of matched terms, then weighted score, then price
            scored.sort(key=lambda x: (-x[0], -x[1], x[2]))
            matched_products = [item[3] for item in scored[:limit]]
        else:
            # When no text query is provided, order by price and take limit
            candidates.sort(key=lambda p: p.price_brl)
            matched_products = candidates[:limit]

        if not matched_products:
            return json.dumps(
                {
                    "message": "Nenhum produto encontrado com os critérios fornecidos.",
                    "total_found": 0,
                    "products": [],
                },
                ensure_ascii=False,
            )

        results = []
        for p in matched_products:
            results.append(
                {
                    "product_id": p.product_id,
                    "name": p.name,
                    "category": p.category.name if p.category else "Geral",
                    "price_brl": float(p.price_brl),
                    "stock_quantity": p.stock_quantity,
                    "in_stock": p.stock_quantity > 0,
                    "description": p.description,
                    "specs": p.specs or {},
                }
            )

        return json.dumps(
            {
                "total_found": len(results),
                "products": results,
            },
            ensure_ascii=False,
        )

    @tool("search_promotions", args_schema=SearchPromotionsInput)
    def search_promotions(
        category_name: str | None = None,
        only_active: bool = True,
    ) -> str:
        """Consulta as promoções cadastradas na loja, seus descontos percentuais e produtos elegíveis."""
        stmt = (
            select(Promotion, Product, Category)
            .join(Product, Product.product_id == Promotion.product_id)
            .join(Category, Category.category_id == Product.category_id)
        )

        if only_active:
            stmt = stmt.where(Promotion.is_active == True)

        if category_name:
            stmt = stmt.where(Category.name.ilike(f"%{category_name.strip()}%"))

        records = db.execute(stmt).all()

        if not records:
            return json.dumps(
                {
                    "message": "Nenhuma promoção ativa encontrada para os critérios informados.",
                    "promotions": [],
                },
                ensure_ascii=False,
            )

        results = []
        for promo, prod, cat in records:
            discount_pct = float(promo.discount_percent)
            original_price = float(prod.price_brl)
            discounted_price = round(original_price * (1.0 - (discount_pct / 100.0)), 2)

            results.append(
                {
                    "promotion_id": promo.promotion_id,
                    "product_name": prod.name,
                    "category": cat.name,
                    "discount_percent": discount_pct,
                    "original_price_brl": original_price,
                    "promotional_price_brl": discounted_price,
                    "description": promo.description,
                    "is_active": promo.is_active,
                }
            )

        return json.dumps(
            {
                "total_active_promotions": len(results),
                "promotions": results,
            },
            ensure_ascii=False,
        )

    @tool("get_customer_orders", args_schema=GetCustomerOrdersInput)
    def get_customer_orders(order_id: int | None = None) -> str:
        """Consulta os pedidos de compra pertencentes ao cliente autenticado na sessão.
        Permite consultar o status, rastreamento, itens comprados e previsão de entrega.
        Nunca permite acessar pedidos de outros clientes.
        """
        if not current_user.customer_id:
            # Check if user has customer record by email
            cust = db.execute(
                select(Customer).where(Customer.email == current_user.email)
            ).scalar_one_or_none()
            cust_id = cust.customer_id if cust else None
        else:
            cust_id = current_user.customer_id

        if not cust_id:
            return json.dumps(
                {
                    "error": "Usuário autenticado não possui um cadastro de cliente associado a pedidos.",
                    "orders": [],
                },
                ensure_ascii=False,
            )

        stmt = (
            select(Order)
            .where(Order.customer_id == cust_id)
            .order_by(Order.order_date.desc().nullslast())
        )

        if order_id is not None:
            stmt = stmt.where(Order.order_id == order_id)

        orders = db.execute(stmt).scalars().all()

        if not orders:
            if order_id:
                return json.dumps(
                    {
                        "message": f"Pedido #{order_id} não encontrado entre os seus pedidos.",
                        "orders": [],
                    },
                    ensure_ascii=False,
                )
            return json.dumps(
                {
                    "message": "Você ainda não possui pedidos registrados na loja.",
                    "orders": [],
                },
                ensure_ascii=False,
            )

        order_list = []
        for o in orders:
            items_list = []
            for item in o.items:
                items_list.append(
                    {
                        "product_id": item.product_id,
                        "product_name": item.product.name if item.product else f"Produto #{item.product_id}",
                        "quantity": item.quantity,
                        "unit_price_brl": float(item.unit_price_brl) if item.unit_price_brl else None,
                    }
                )

            order_list.append(
                {
                    "order_id": o.order_id,
                    "order_date": str(o.order_date) if o.order_date else None,
                    "status": o.status,
                    "total_brl": float(o.total_brl),
                    "payment_method": o.payment_method,
                    "tracking_code": o.tracking_code,
                    "estimated_delivery": str(o.estimated_delivery) if o.estimated_delivery else None,
                    "notes": o.notes,
                    "items": items_list,
                }
            )

        return json.dumps({"orders": order_list}, ensure_ascii=False)

    @tool("search_store_policies", args_schema=SearchKnowledgeBaseInput)
    def search_store_policies(query: str, limit: int = 3) -> str:
        """Consulta as políticas oficiais da loja Empório da Música através do sistema de Hybrid RAG.
        Use esta ferramenta para responder dúvidas sobre:
        - Prazos e regras de trocas e devoluções
        - Garantia legal e garantia da loja
        - Regras de frete e prazos dos Correios/transportadora
        - Formas de pagamento aceitas e descontos à vista/PIX
        - Horário de funcionamento e atendimento em Campo Grande - MS
        Retorna trechos exatos com a página do documento oficial para citação.
        """
        retriever = HybridRetriever(db=db)
        search_result = retriever.search_hybrid(query=query, limit=limit)

        if not search_result.has_retrieved_results:
            return json.dumps(
                {
                    "message": "Nenhum trecho relevante encontrado nas políticas da loja para essa dúvida.",
                    "results": [],
                },
                ensure_ascii=False,
            )

        chunks_data = []
        for r in search_result.results:
            chunks_data.append(
                {
                    "document_name": r.document_name,
                    "file_name": r.file_name,
                    "page": r.page,
                    "excerpt": r.content,
                    "score": round(float(r.score), 4) if getattr(r, "score", None) is not None else None,
                    "citation": f"{r.document_name}, pág. {r.page}",
                }
            )

        return json.dumps(
            {
                "total_results": len(chunks_data),
                "chunks": chunks_data,
            },
            ensure_ascii=False,
        )

    @tool("escalate_to_human_support", args_schema=EscalateToHumanSupportInput)
    def escalate_to_human_support(reason: str) -> str:
        """Encaminha o atendimento para a equipe humana de suporte da Empório da Música.
        Deve ser acionado quando:
        - O cliente solicita expressamente falar com um atendente humano.
        - Há uma reclamação formal, produto avariado ou problema grave de entrega.
        - A dúvida ou problema não pode ser resolvida com os dados disponíveis e exige intervenção da gerência.
        Cria um ticket no sistema de suporte e gera o protocolo.
        """
        ticket = SupportTicket(
            id=uuid.uuid4(),
            user_id=current_user.id,
            conversation_id=conversation_id,
            reason=reason.strip(),
            status="pending",
        )
        db.add(ticket)
        db.commit()

        protocol = f"TICK-{str(ticket.id)[:8].upper()}"
        return json.dumps(
            {
                "escalated": True,
                "ticket_id": str(ticket.id),
                "protocol": protocol,
                "reason": reason,
                "message": (
                    f"Atendimento encaminhado para nossa equipe humana com sucesso. "
                    f"Protocolo registrado: {protocol}. Um atendente dará continuidade em breve."
                ),
            },
            ensure_ascii=False,
        )

    return [
        search_products,
        search_promotions,
        get_customer_orders,
        search_store_policies,
        escalate_to_human_support,
    ]

