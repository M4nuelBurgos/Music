# YT Music Downloader

Application for downloading music from YouTube as MP3 files directly through a web interface. Supports individual videos, complete playlists, and batch URL processing.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-black?style=flat-square&logo=flask)
![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-red?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- **MP3 Conversion**: Download as MP3 (192 kbps) or maintain original format
- **Batch Processing**: Process multiple URLs simultaneously, one per line
- **Playlist Support**: Download complete YouTube playlists with a single request
- **Metadata Embedding**: Automatic extraction and embedding of cover art and artist information
- **Automatic Packaging**: Multiple files are automatically compressed into a single ZIP archive
- **Web Interface**: User-friendly interface eliminates the need for terminal usage

## Preview

The interface implements a modern glassmorphism design with dark theme aesthetic.

![Preview](docs/preview.png)

## Installation

### Prerequisites

The following tools are required before proceeding:

| Tool | Minimum Version | Download |
|---|---|---|
| **Python** | 3.8+ | [python.org](https://www.python.org/downloads/) |
| **FFmpeg** | Latest | [ffmpeg.org](https://ffmpeg.org/download.html) |

**Note**: FFmpeg is required for MP3 conversion. After installation, ensure it is added to your system PATH.

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/M4nuelBurgos/Music.git
cd Music

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Verify FFmpeg Installation

Open a terminal and run:
```bash
ffmpeg -version
```
Successful output confirms proper installation.

## Usage

Start the application:
```bash
python app.py
```

Access the web interface at: **[http://localhost:5000](http://localhost:5000)**

### Workflow

1. Enter one or more YouTube URLs (one per line)
2. Toggle "Convert to MP3" as needed
3. Click **Download**
4. Wait for processing and save the file(s)

## Project Structure

```
Music/
├── app.py                  # Flask application entry point
├── requirements.txt        # Python dependencies
├── models/
│   └── downloader.py       # Download logic using yt-dlp
├── templates/
│   └── index.html          # Web interface
├── static/
│   ├── css/style.css       # Stylesheet (glassmorphism)
│   └── js/main.js          # Frontend logic
└── downloads/              # Output directory (excluded from version control)
```

## Configuration

By default, the server runs on port `5000`. To modify this, edit the last line in `app.py`:

```python
app.run(debug=True, port=5000)  # Change 5000 to your desired port
```

For production deployment, change `debug=True` to `debug=False`.

## Legal Notice

This project is intended for educational and personal use only. Users are responsible for ensuring they have the rights to download and use any content obtained through this application. Unauthorized downloading or distribution of copyrighted material is prohibited.

## License

This project is distributed under the MIT License. See the [LICENSE](LICENSE) file for details.
