interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const SendIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
)

export const RepeatIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </svg>
)

export const CloudIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M17.5 19a4.5 4.5 0 1 0-1.2-8.84A6 6 0 0 0 4.6 12.2 3.4 3.4 0 0 0 6.5 19Z" />
  </svg>
)
