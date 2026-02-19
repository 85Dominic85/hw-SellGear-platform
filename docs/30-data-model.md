# Modelo de datos (borrador)

## `orders`
Campos base (derivados del Excel):
- `operation_id` (texto único)
- `customer_name`, `venue_name`
- `purchase_type`, `source_department`
- `amount`
- `bank_receipt_url`
- `ae_ref`
- `shipping_address`
- `status`
- `notes`
- `phone`, `contact_email`
- `hubspot_ref`, `invoice_ref`
- `assigned_to`
- `sheet_tab`, `sheet_row`

## `order_items`
- `order_id`
- `product_name`
- `qty`

## `status_history`
- `order_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `comment`
