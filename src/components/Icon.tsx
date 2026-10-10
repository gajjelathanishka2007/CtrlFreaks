import { ICONS, type IconName } from './iconMap'

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const Component = (ICONS as Record<string, typeof ICONS.Circle>)[name] ?? ICONS.Circle
  return <Component size={size} className={className} aria-hidden="true" />
}
