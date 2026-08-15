import yt_dlp
import os

def download_audio(urls, output_path, convert_to_mp3=True):
    """
    Downloads audio from YouTube URLs and saves them to the output path.
    Returns a list of final file paths and a generic title.
    """
    if isinstance(urls, str):
        urls = [urls]
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
        'noplaylist': False,
        'extractor_args': {'youtube': ['player_client=android,web']},
    }

    if convert_to_mp3:
        ydl_opts['writethumbnail'] = True
        ydl_opts['postprocessors'] = [
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            },
            {
                'key': 'EmbedThumbnail',
            },
            {
                'key': 'FFmpegMetadata',
            }
        ]

    downloaded_files = []
    titles = []

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                info_dict = ydl.extract_info(url, download=True)
                
                # Check if it's a playlist or a single video
                if 'entries' in info_dict:
                    entries = info_dict['entries']
                    titles.append(info_dict.get('title', 'Playlist'))
                else:
                    entries = [info_dict]
                    titles.append(info_dict.get('title', 'audio'))
                
                for entry in entries:
                    if not entry:
                        continue # Skip hidden or deleted videos in a playlist
                        
                    if convert_to_mp3:
                        prepared_filename = ydl.prepare_filename(entry)
                        final_file_path = prepared_filename.rsplit('.', 1)[0] + '.mp3'
                    else:
                        final_file_path = ydl.prepare_filename(entry)
                    
                    downloaded_files.append(final_file_path)
            except Exception as e:
                print(f"Failed to download {url}: {str(e)}")
                
    final_title = titles[0] if len(titles) == 1 else f"{len(downloaded_files)} canciones descargadas"
    return downloaded_files, final_title
