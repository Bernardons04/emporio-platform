# Example 01: Product Catalog Inquiry (Yamaha Acoustic Guitars)

## Scenario & Objective
A customer accesses the chat assistant to explore available Yamaha acoustic guitars (*violões*) in the store catalog, inquiring about specific models, characteristics, and prices in Brazilian Reais (BRL).

The assistant must:
- Detect the musical instrument intent and use structured relational database tools rather than document retrieval.
- Query available products from PostgreSQL.
- Return accurate pricing, stock availability, and instrument specifications.

---

## Customer Question
> "Estou procurando um violão da Yamaha. Quais modelos vocês têm disponíveis e quanto custa cada um?"

---

## Tools Invoked

### 1. `search_products`
- **Purpose**: Search musical instruments in PostgreSQL with lexical ranking (supporting accents, singular/plural variants, and category scoping).
- **Execution Order**: 1
- **Arguments**:
  ```json
  {
    "query": "violão Yamaha",
    "category_name": "Violões"
  }
  ```
- **Relevant Tool Output**:
  ```json
  {
    "total_found": 6,
    "products": [
      {
        "name": "Yamaha F310 Aço Natural",
        "category": "Violões",
        "price_brl": 699.9,
        "stock_quantity": 14,
        "in_stock": true,
        "description": "Violão folk aço Yamaha com corpo robusto e timbre encorpado. Um dos modelos mais vendidos do mundo para iniciantes e intermediários.",
        "specs": {
          "top": "Spruce",
          "neck": "Nato",
          "color": "Natural",
          "scale": "634mm",
          "strings": "steel",
          "back_sides": "Meranti",
          "electronics": "no"
        }
      },
      {
        "name": "Yamaha FG800 Dreadnought Natural",
        "category": "Violões",
        "price_brl": 1299.0,
        "stock_quantity": 7,
        "in_stock": true,
        "description": "Violão dreadnought Yamaha com tampo sólido em Spruce. Tecnologia de bracing exclusiva para som rico e encorpado.",
        "specs": {
          "top": "Spruce Sólido",
          "neck": "Nato",
          "color": "Natural",
          "scale": "650mm",
          "strings": "steel",
          "back_sides": "Nato",
          "electronics": "no"
        }
      },
      {
        "name": "Yamaha CG162S Nylon Natural",
        "category": "Violões",
        "price_brl": 1699.0,
        "stock_quantity": 4,
        "in_stock": true,
        "description": "Violão clássico Yamaha com tampo sólido em Spruce Engelmann. Acabamento refinado e sonoridade de concerto para estudantes avançados.",
        "specs": {
          "top": "Spruce Engelmann Sólido",
          "neck": "Nato",
          "color": "Natural",
          "scale": "650mm",
          "strings": "nylon",
          "back_sides": "Ovangkol",
          "electronics": "no"
        }
      },
      {
        "name": "Yamaha APX600 Elétrico Aço Preto",
        "category": "Violões",
        "price_brl": 1899.0,
        "stock_quantity": 7,
        "in_stock": true,
        "description": "Violão eletroacústico Yamaha com corpo slim e captação piezo. Design moderno e confortável para performances no palco.",
        "specs": {
          "top": "Spruce",
          "neck": "Nato",
          "color": "Preto",
          "scale": "634mm",
          "strings": "steel",
          "back_sides": "Nato",
          "electronics": "yes"
        }
      },
      {
        "name": "Yamaha C40 Nylon Natural",
        "category": "Violões",
        "price_brl": 599.9,
        "stock_quantity": 12,
        "in_stock": true,
        "description": "Violão clássico Yamaha campeão de vendas mundial. Timbre quente e tocabilidade suave para estudantes e iniciantes.",
        "specs": {
          "top": "Spruce",
          "neck": "Nato",
          "color": "Natural",
          "scale": "650mm",
          "strings": "nylon",
          "back_sides": "Meranti",
          "electronics": "no"
        }
      },
      {
        "name": "Yamaha C70 Nylon Natural",
        "category": "Violões",
        "price_brl": 849.0,
        "stock_quantity": 8,
        "in_stock": true,
        "description": "Violão clássico intermediário com tampo em Spruce sólido, acabamento de alta qualidade e sonoridade equilibrada.",
        "specs": {
          "top": "Spruce Sólido",
          "neck": "Nato",
          "color": "Natural",
          "scale": "650mm",
          "strings": "nylon",
          "back_sides": "Nato",
          "electronics": "no"
        }
      }
    ]
  }
  ```

---

## Agent Response (Original Transcript)
> Olá! Que bom que você está procurando um violão Yamaha. Temos vários modelos excelentes disponíveis na Empório da Música:
>
> *   **Yamaha F310 Aço Natural**: Um violão folk de aço com corpo robusto e timbre encorpado, ideal para iniciantes e intermediários. Custa **R$ 699,90**.
> *   **Yamaha FG800 Dreadnought Natural**: Violão dreadnought com tampo sólido em Spruce, que oferece um som rico e encorpado. Custa **R$ 1.299,00**.
> *   **Yamaha CG162S Nylon Natural**: Violão clássico com tampo sólido em Spruce Engelmann, acabamento refinado e sonoridade de concerto, perfeito para estudantes avançados. Custa **R$ 1.699,00**.
> *   **Yamaha APX600 Elétrico Aço Preto**: Violão eletroacústico com corpo slim e captação piezo, design moderno e confortável para performances no palco. Custa **R$ 1.899,00**.
> *   **Yamaha C40 Nylon Natural**: Violão clássico com tampo em Spruce e fundo/laterais em Meranti, ideal para estudantes e iniciantes, com excelente projeção sonora. Custa **R$ 599,90**.
> *   **Yamaha C70 Nylon Natural**: Violão clássico de nível intermediário com tampo em Spruce sólido, acabamento de alta qualidade e timbre equilibrado. Custa **R$ 849,00**.
>
> Todos esses modelos estão disponíveis em estoque! Se tiver mais alguma dúvida ou quiser saber mais detalhes sobre algum deles, é só me dizer!

---

## Evidence & Verification

- **Retrieval Category**: Relational database search (PostgreSQL SQL / SQLAlchemy query via `search_products`).
- **Structured Data Integrity**: Product names, categories, prices in BRL, and stock quantities presented in the response were directly verified against the structured tool output and PostgreSQL database records.
- **Specification Grounding**: The product descriptions and specifications presented in the assistant's response are supported by the retrieved product records. In particular, the APX600's piezo pickup and the C70's solid Spruce top are explicitly present in the tool output.
- **Availability**: All six retrieved products were marked as in stock (`in_stock: true`).
- **UI Screenshot**:
  ![Product Catalog Screenshot](../assets/example-product-catalog.png)