export function SideNav({ onOpenCommands }: { onOpenCommands?: () => void }) {
  return (
    <nav class="universe-side-nav" aria-label="Universe navigation">
      <div class="universe-logo">rg</div>
      <button type="button" class="universe-nav-btn active" aria-label="Cosmos" title="Cosmos">
        ◎
      </button>
      <button
        type="button"
        class="universe-nav-btn"
        aria-label="Universe commands"
        title="Commands"
        data-testid="universe-commands-open"
        onClick={onOpenCommands}
      >
        ⌘
      </button>
    </nav>
  );
}
