import { relations, sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const role = pgEnum('role', ['customer', 'staff'])
export const orderStatus = pgEnum('order_status', ['pending', 'fulfilled', 'cancelled'])

export const prizes = pgTable(
  'prizes',
  {
    id: serial().primaryKey(),
    sku: varchar({ length: 32 }).notNull().unique(),
    name: varchar({ length: 120 }).notNull(),
    description: text().notNull().default(''),
    category: varchar({ length: 40 }).notNull(),
    ticketCost: integer().notNull(),
    stock: integer().notNull().default(0),
    image: varchar({ length: 200 }).notNull().default(''),
  },
  (t) => [
    index().on(t.category),
    check('stock_non_negative', sql`${t.stock} >= 0`),
    check('cost_positive', sql`${t.ticketCost} > 0`),
  ],
)

/** A ticket balance. Guests have a wallet with no account. */
export const wallets = pgTable(
  'wallets',
  {
    id: uuid().primaryKey().defaultRandom(),
    balance: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('balance_non_negative', sql`${t.balance} >= 0`)],
)

export const accounts = pgTable('accounts', {
  id: uuid().primaryKey().defaultRandom(),
  email: varchar({ length: 254 }).notNull().unique(),
  displayName: varchar({ length: 80 }).notNull(),
  passwordHash: varchar({ length: 200 }).notNull(),
  role: role().notNull().default('customer'),
  walletId: uuid()
    .notNull()
    .unique()
    .references(() => wallets.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/** A printed redemption stub. The code is the secret encoded in its QR. */
export const ticketStubs = pgTable(
  'ticket_stubs',
  {
    id: serial().primaryKey(),
    code: varchar({ length: 32 }).notNull().unique(),
    tickets: integer().notNull(),
    kioskId: varchar({ length: 64 }).notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp({ withTimezone: true }),
    walletId: uuid().references(() => wallets.id),
  },
  (t) => [check('tickets_positive', sql`${t.tickets} > 0`)],
)

/** Append-only record of every balance change, for auditing and shrink tracking. */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: serial().primaryKey(),
    walletId: uuid()
      .notNull()
      .references(() => wallets.id),
    delta: integer().notNull(),
    reason: varchar({ length: 32 }).notNull(),
    reference: varchar({ length: 64 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.walletId)],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    walletId: uuid()
      .notNull()
      .references(() => wallets.id),
    pickupCode: varchar({ length: 8 }).notNull().unique(),
    status: orderStatus().notNull().default('pending'),
    totalTickets: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
    fulfilledBy: uuid().references(() => accounts.id),
  },
  (t) => [index().on(t.walletId), index().on(t.status)],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: serial().primaryKey(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    prizeId: integer()
      .notNull()
      .references(() => prizes.id),
    quantity: integer().notNull(),
    unitCost: integer().notNull(),
  },
  (t) => [index().on(t.orderId), check('quantity_positive', sql`${t.quantity} > 0`)],
)

export type Prize = typeof prizes.$inferSelect
export type Account = typeof accounts.$inferSelect
export type OrderStatus = (typeof orderStatus.enumValues)[number]

// Relations for `db.query.*` lookups that load an order with its items and prizes.

export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems) }))
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  prize: one(prizes, { fields: [orderItems.prizeId], references: [prizes.id] }),
}))
export const accountsRelations = relations(accounts, ({ one }) => ({
  wallet: one(wallets, { fields: [accounts.walletId], references: [wallets.id] }),
}))
