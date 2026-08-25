import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Boxes, ReceiptText, Layers } from 'lucide-react'

interface CatalogHeroProps {
  /** Nº de productos peninsulares, para la fila de datos. */
  productCount: number
}

/**
 * Hero del catálogo comercial, portado del origen.
 *
 * NO se porta su header sticky ni su footer oscuro: el dashboard ya tiene su
 * propia navegación, y dos barras compitiendo no es fidelidad, es un collage.
 * Las tres fotos son productos que ya tenemos, así que no hace falta ningún
 * asset extra.
 */
export default function CatalogHero({ productCount }: CatalogHeroProps) {
  return (
    <section className="hero">
      <div className="hero-inner section-shell">
        <div className="hero-copy">
          <span className="eyebrow">Catálogo de hardware Qamarero</span>
          <h1>Elige el hardware para cada zona del local.</h1>
          <p>
            Compara packs, TPV, KDS, impresoras y periféricos compatibles con
            Qamarero. Monta la selección para caja, barra o cocina y pásala
            directamente a un pedido.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="#catalogo">
              Explorar equipos <ArrowDown size={18} aria-hidden="true" />
            </Link>
            <Link className="button button-secondary" href="/catalogo/pack">
              Ver packs <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div
          className="hero-showcase"
          role="group"
          aria-label="Equipamiento para caja, impresión y cocina"
        >
          <div className="hero-showcase-panel" aria-hidden="true" />
          <div className="hero-device hero-device-tpv">
            <Image
              src="/products/tpv-estandar.webp"
              alt="Terminal TPV del catálogo Qamarero"
              fill
              priority
              sizes="(max-width: 800px) 58vw, 26vw"
            />
          </div>
          <div className="hero-device hero-device-kds">
            <Image
              src="/products/kds-premium.webp"
              alt="Pantalla KDS para cocina"
              fill
              priority
              sizes="(max-width: 800px) 35vw, 18vw"
            />
          </div>
          <div className="hero-device hero-device-printer">
            <Image
              src="/products/printer-cable.webp"
              alt="Impresora de tickets para barra o cocina"
              fill
              priority
              sizes="(max-width: 800px) 25vw, 12vw"
            />
          </div>
          <div className="hero-showcase-caption">
            <span>TPV · Impresora · KDS</span>
            <strong>Caja · Barra · Cocina</strong>
          </div>
        </div>
      </div>

      <div className="trust-row section-shell" aria-label="Datos del catálogo">
        <span>
          <Boxes size={18} aria-hidden="true" /> {productCount} opciones
        </span>
        <span>
          <ReceiptText size={18} aria-hidden="true" /> Precios sin IVA
        </span>
        <span>
          <Layers size={18} aria-hidden="true" /> Canarias con precio final
        </span>
      </div>
    </section>
  )
}
