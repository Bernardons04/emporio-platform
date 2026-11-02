# Import all models here so Alembic can discover them
from app.models.user import User, Session  # noqa: F401
from app.models.customer import Customer  # noqa: F401
from app.models.product import Category, Product  # noqa: F401
from app.models.promotion import Promotion  # noqa: F401
from app.models.order import Order, OrderItem  # noqa: F401
from app.models.conversation import Conversation, Message, MessageEvent  # noqa: F401
from app.models.document import Document, DocumentChunk  # noqa: F401
from app.models.support import SupportTicket  # noqa: F401
from app.models.log import ErrorLog  # noqa: F401
