type ToggleButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

export default function ToggleButton({ active, onClick, children }: ToggleButtonProps) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  )
}
