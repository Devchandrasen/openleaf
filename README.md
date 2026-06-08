# Openleaf 🍃

Openleaf is a free, open-source LaTeX editor for Windows, designed with simplicity and real-time visual feedback in mind. Built with Electron and React, it brings powerful features directly to your local workspace.

## Features ✨

- **Real-Time PDF Preview**: Syncs your LaTeX edits directly with a live-updating PDF viewer.
- **Peer-to-Peer Sharing**: Host your project locally and generate a secure public link for others to view and download your files over the internet.
- **🤖 AI Assistant**: Integrates with local open-source LLMs (like Ollama) to automatically analyze compilation logs and help you fix LaTeX errors.
- **Themes**: Instantly switch between Light and Dark mode.
- **Modern UI**: A fully functional sidebar file tree, code editor (CodeMirror), and PDF layout.

## Installation 📥

You can download the latest Windows installer (`.exe`) directly from the [Releases](../../releases) page!

## Getting Started 🚀

1. Ensure you have a TeX distribution (like MiKTeX or TeX Live) installed on your system.
2. Run the Openleaf app.
3. Open a folder containing your `.tex` files or create a new one.
4. Set your main file and click "Compile" (or press `Ctrl+S` / `Cmd+S`)!

### Setting up the AI Assistant 🧠

Openleaf connects to local models for maximum privacy.
1. Download and install [Ollama](https://ollama.com).
2. Open a terminal and run your preferred model, e.g., `ollama run llama3`.
3. Openleaf will automatically detect the running model and provide intelligent error correction in the Compile Log panel.

## Development 💻

If you want to build Openleaf from source:

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Package the Windows Installer
npm run dist
```

## Credits 👨‍💻
Developed by **Dr Chandrasen Pandey** and the Openleaf community.

License: MIT
