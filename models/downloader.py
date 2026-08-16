import yt_dlp
import os
import re

def is_valid_youtube_url(url):
    """
    Validates if a URL is a valid YouTube URL.
    """
    youtube_regex = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
    return bool(re.match(youtube_regex, url))


def get_available_formats(url):
    """
    Lists the audio-only formats/qualities available for a single video,
    without downloading anything. Useful to let the user pick a quality
    before committing to a download.

    Returns a list of dicts like:
    [{'format_id': '251', 'ext': 'webm', 'acodec': 'opus',
      'abr': 160, 'filesize_approx': 4123456, 'label': 'webm · opus · ~160kbps'}, ...]
    sorted from highest to lowest bitrate.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': ['player_client=android,web']},
        'noplaylist': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if 'entries' in info:
        # First video only, if a playlist URL was passed for a preview
        info = next((e for e in info['entries'] if e), info)

    formats = []
    for f in info.get('formats', []):
        # audio-only formats have no video codec (or it's explicitly 'none')
        if f.get('vcodec') not in (None, 'none'):
            continue
        if f.get('acodec') in (None, 'none'):
            continue

        abr = f.get('abr') or f.get('tbr')
        ext = f.get('ext', '?')
        acodec = f.get('acodec', '?')
        label_bitrate = f"~{int(abr)}kbps" if abr else "unknown bitrate"
        formats.append({
            'format_id': f.get('format_id'),
            'ext': ext,
            'acodec': acodec,
            'abr': abr or 0,
            'filesize_approx': f.get('filesize') or f.get('filesize_approx'),
            'label': f"{ext} · {acodec} · {label_bitrate}",
        })

    formats.sort(key=lambda x: x['abr'], reverse=True)

    return {
        'title': info.get('title'),
        'duration': info.get('duration'),
        'formats': formats,
    }


def download_audio(urls, output_path, convert_to_mp3=True, progress_hook=None,
                    max_urls=20, format_id=None):
    """
    Downloads audio from YouTube URLs and saves them to the output path.
    Returns a list of final file paths and a generic title.

    progress_hook: optional callable(dict) forwarded to yt-dlp's progress_hooks,
                   lets the caller (e.g. Flask route) report real download progress.
    format_id: optional specific yt-dlp format id (from get_available_formats)
               to download that exact quality instead of "best". Only makes
               sense when downloading a single URL — with multiple URLs it's
               ignored and "bestaudio/best" is used, since format ids aren't
               guaranteed to exist across different videos.
    """
    if isinstance(urls, str):
        urls = [urls]

    if len(urls) > max_urls:
        raise ValueError(f"Too many URLs (max {max_urls} per request).")

    chosen_format = 'bestaudio/best'
    if format_id and len(urls) == 1:
        chosen_format = f'{format_id}/bestaudio/best'

    # %(id)s in the template avoids two videos with the same title silently
    # overwriting each other.
    ydl_opts = {
        'format': chosen_format,
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
                # Tries to split "Artist - Song Title" into separate artist/title
                # fields. If the video title doesn't match that pattern, it's a
                # no-op and the original title is kept as-is.
                'key': 'MetadataFromTitle',
                'titleformat': '%(artist)s - %(title)s',
            },
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            },
            {
                'key': 'EmbedThumbnail',
            },
            {
                # add_metadata writes title/artist/album/date/etc. from the
                # info dict into the mp3's ID3 tags. Year comes from
                # upload_date automatically when present.
                'key': 'FFmpegMetadata',
                'add_metadata': True,
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
                        base_path = prepared_filename.rsplit('.', 1)[0]
                        final_file_path = base_path + '.mp3'

                        # The thumbnail was already embedded into the mp3's
                        # cover art by the EmbedThumbnail postprocessor above.
                        # Remove the leftover standalone image file so only
                        # the .mp3 remains in the output folder.
                        for ext in ('.webp', '.jpg', '.jpeg', '.png'):
                            leftover_thumb = base_path + ext
                            if os.path.exists(leftover_thumb):
                                try:
                                    os.remove(leftover_thumb)
                                except OSError:
                                    pass  # not critical if cleanup fails
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