# Keyboard Quickstart

VideoDefaults uses a tmux-style prefix chord — press the prefix, then a command key.

## Platform notes

Windows and Linux use `Ctrl+A` as the prefix. macOS defaults to `Cmd+A`
automatically. The prefix (and every chord) can be changed to whatever you
want via the extension's stored settings, same as any other override.

| Key / Chord | Action | Context |
| --- | --- | --- |
| `Ctrl+A` | Prefix — arms the next key as a command (default binding, configurable) | Global |
| `Ctrl+A` then `o` | Open jump overlay (labels clickable elements) | Global |
| `Ctrl+A` then `p` | Open queue overlay (labels videos with an "Add to queue" option; typing a label adds that video next) | Global |
| `Ctrl+A` then `y` | Go home (click YouTube logo, or navigate to configured home URL) | Global |
| `Ctrl+A` then `v` | Set playback speed to preset 1 (default `1×`) | Global |
| `Ctrl+A` then `b` | Set playback speed to preset 2 (default `1.5×`) | Global |
| `Ctrl+A` then `n` | Set playback speed to preset 3 (default `2×`) | Global |
| `Ctrl+A` then `h` | Toggle auto-apply default speed on video load | Global |
| `Ctrl+A` then `Esc` | Cancel pending prefix | Global |
| Two-char label (e.g. `AA`) | Filter/select the labelled target; typing the full label activates it | Jump/queue overlay open |
| `Backspace` | Remove last typed label character | Jump/queue overlay open |
| `Esc` | Close overlay | Jump/queue overlay open |

Pending prefix auto-cancels after 2 seconds if no chord key follows.
