import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import OrderStatus, Role


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PrizeOut(ORM):
    id: int
    sku: str
    name: str
    description: str
    category: str
    ticket_cost: int
    stock: int
    image: str


class StockUpdate(BaseModel):
    stock: int = Field(ge=0, le=100_000)


class StubCreate(BaseModel):
    tickets: int = Field(gt=0, le=1_000_000)
    kiosk_id: str = Field(default="kiosk-1", max_length=64)


class StubOut(BaseModel):
    code: str
    tickets: int
    claim_url: str
    qr_url: str


class StubPreview(BaseModel):
    tickets: int
    claimed: bool


class AccountOut(ORM):
    id: uuid.UUID
    email: str
    display_name: str
    role: Role


class Session(BaseModel):
    token: str
    balance: int
    account: AccountOut | None = None


class ClaimResult(Session):
    credited: int


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Me(BaseModel):
    balance: int
    account: AccountOut | None = None


class CartLine(BaseModel):
    prize_id: int
    quantity: int = Field(gt=0, le=100)


class OrderIn(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=50)


class OrderItemOut(ORM):
    prize_id: int
    quantity: int
    unit_cost: int
    prize: PrizeOut


class OrderOut(ORM):
    id: uuid.UUID
    pickup_code: str
    status: OrderStatus
    total_tickets: int
    created_at: datetime
    closed_at: datetime | None
    items: list[OrderItemOut]
