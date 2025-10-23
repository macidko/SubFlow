A Chrome extension that makes learning words easier in YouTube subtitles.

## Features
- Colors words in subtitles
- Records word statuses
- Automatic translation
- Import/export word list
- Perfect YouTube subtitle mimicry with zero layout shift

## CSS Architecture

The extension uses a modular CSS architecture for maintainability:

- **`perfect-mimic-styles.css`**: Core container and line styling that perfectly mimics YouTube's subtitle appearance
- **`subtitle-words.css`**: Word-specific styling including hover effects, focus states, and color coding
- **`subtitle-core.css`**: Additional container styling with responsive design and accessibility features
- **`responsive.css`**: Device-specific responsive adjustments

## Installation

1. Clone the repository
2. Open `chrome://extensions/` in Chrome
3. Enable developer mode
4. Select the project folder from the "Load unpacked extension" option

## Usage

Open a subtitled video on YouTube. Ctrl-click on a word in the subtitles to mark its status. Manage your word list from the popup.

### Chrome Web Store (Coming soon)
