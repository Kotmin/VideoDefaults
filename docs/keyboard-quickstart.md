# Keyboard Quickstart

VideoDefaults uses a tmux-style prefix chord — press the prefix, then a command key.

| Key / Chord | Action | Context |
| --- | --- | --- |
| `Ctrl+A` | Prefix — arms the next key as a command (default binding, configurable) | Global |
| `Ctrl+A` then `o` | Open jump overlay (labels clickable elements) | Global |
| `Ctrl+A` then `y` | Go home (click YouTube logo, or navigate to configured home URL) | Global |
| `Ctrl+A` then `Esc` | Cancel pending prefix | Global |
| `a`-`z` (typed label) | Filter/select a labelled target; exact match activates it | Jump overlay open |
| `Backspace` | Remove last typed label character | Jump overlay open |
| `Esc` | Close jump overlay | Jump overlay open |

Pending prefix auto-cancels after 2 seconds if no chord key follows.
