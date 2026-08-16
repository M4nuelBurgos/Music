import yt_dlp
import os
import re

def is_valid_youtube_url(url):
    """
    Validates if a URL is a valid YouTube URL.
    """
    youtube_regex = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
    return bool(re.match(youtube_regex, url))


def download_audio(urls, output_path, convert_to_mp3=True, progress_hook=None, max_urls=20):
    """
    Downloads audio from YouTube URLs and saves them to the output path.
    Returns a list of final file paths and a generic title.

    progress_hook: optional callable(dict) forwarded to yt-dlp's progress_hooks,
                   lets the caller (e.g. Flask route) report real download progress.
    """
    if isinstance(urls, str):
        urls = [urls]

    if len(urls) > max_urls:
        raise ValueError(f"Too many URLs (max {max_urls} per request).")

    # %(id)s in the template avoids two videos with the same title silently
    # overwriting each other.
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_path, '%(title)s [%(id)s].%(ext)s'),
        'noplaylist': False,
        'extractor_args': {'youtube': ['player_client=android,web']},
        'restrictfilenames': True,  # avoids characters that break URLs / filesystems
    }

    if progress_hook:
        ydl_opts['progress_hooks'] = [progress_hook]

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
    failed = []

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                info_dict = ydl.extract_info(url, download=True)

                if 'entries' in info_dict:
                    entries = info_dict['entries']
                    titles.append(info_dict.get('title', 'Playlist'))
                else:
                    entries = [info_dict]
                    titles.append(info_dict.get('title', 'audio'))

                for entry in entries:
                    if not entry:
                        continue  # Skip hidden or deleted videos in a playlist

                    if convert_to_mp3:
                        prepared_filename = ydl.prepare_filename(entry)
                        final_file_path = prepared_filename.rsplit('.', 1)[0] + '.mp3'
                    else:
                        final_file_path = ydl.prepare_filename(entry)

                    downloaded_files.append(final_file_path)

            except yt_dlp.utils.DownloadError as e:
                # Specific, more useful message than a generic Exception
                msg = str(e)
                if 'Private video' in msg:
                    reason = 'This video is private.'
                elif 'unavailable' in msg.lower():
                    reason = 'This video is unavailable in your region or was removed.'
                elif 'Sign in' in msg:
                    reason = 'This video requires sign-in and cannot be downloaded.'
                else:
                    reason = 'The video could not be downloaded.'
                failed.append({'url': url, 'reason': reason})
            except Exception as e:
                failed.append({'url': url, 'reason': str(e)})

    if not downloaded_files and failed:
        # Everything failed — surface the first concrete reason
        raise Exception(failed[0]['reason'])

    final_title = titles[0] if len(titles) == 1 else f"{len(downloaded_files)} songs downloaded"
    return downloaded_files, final_title, failed