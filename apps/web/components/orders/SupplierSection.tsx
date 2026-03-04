'use client'

import { useState, useEffect } from 'react'
import SupplierSelect from './SupplierSelect'
import SupplierEmailButton from './SupplierEmailButton'

interface OrderItem {
  product_name: string
  qty: number
}

interface SupplierSectionProps {
  orderId: string
  currentSupplier: string | null
  operationId: string
  customerName: string
  venueName?: string | null
  phone?: string | null
  contactEmail?: string | null
  shippingAddress?: string | null
  notes?: string | null
  items: OrderItem[]
}

export default function SupplierSection({
  orderId,
  currentSupplier,
  operationId,
  customerName,
  venueName,
  phone,
  contactEmail,
  shippingAddress,
  notes,
  items,
}: SupplierSectionProps) {
  const [supplier, setSupplier] = useState(currentSupplier ?? '')

  useEffect(() => { setSupplier(currentSupplier ?? '') }, [currentSupplier])

  return (
    <>
      <SupplierSelect
        orderId={orderId}
        currentSupplier={currentSupplier}
        onSupplierChange={setSupplier}
      />
      <SupplierEmailButton
        supplier={supplier || null}
        operationId={operationId}
        customerName={customerName}
        venueName={venueName}
        phone={phone}
        contactEmail={contactEmail}
        shippingAddress={shippingAddress}
        notes={notes}
        items={items}
      />
    </>
  )
}
