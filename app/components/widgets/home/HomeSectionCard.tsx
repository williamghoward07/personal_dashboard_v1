import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import WidgetCard from '../../WidgetCard'
import type { Accent } from '@/lib/theme'
import { ACCENT_TEXT } from '@/lib/theme'

export default function HomeSectionCard({
  href,
  title,
  icon,
  accent = 'neutral',
  className = '',
  children,
}: {
  href: string
  title: string
  icon?: ReactNode
  accent?: Accent
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={`block ${className}`}>
      <WidgetCard
        title={title}
        icon={icon}
        accent={accent}
        action={<ArrowUpRight className={`h-4 w-4 ${ACCENT_TEXT[accent]}`} />}
        className="h-full"
      >
        {children}
      </WidgetCard>
    </Link>
  )
}
