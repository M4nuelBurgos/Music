from flask import Flask, render_template, request, jsonify, send_file
import os
import zipfile
import time
import uuid
import threading
from pathlib import Path
from werkzeug.utils import secure_filename
from models.downloader import download_audio, is_valid_youtube_url

app = Flask(__name__)

# Use user's Downloads folder
DOWNLOADS_FOLDER = str(Path.home() / 'Downloads' / 'YT-Music')
app.config['DOWNLOAD_FOLDER'] = DOWNLOADS_FOLDER
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

MAX_URLS_PER_REQUEST = 20

# In-memory job store for progress polling.
# jobs[job_id] = {"percent": 0-100, "status": "downloading"|"done"|"error", ...}
# Fine for a single-user local app; swap for Redis if this ever needs to scale.
jobs = {}
jobs_lock = threading.Lock()


def make_progress_hook(job_id):
    def hook(d):
        with jobs_lock:
            job = jobs.get(job_id)
            if not job:
                return
            if d['status'] == 'downloading':
                percent_str = d.get('_percent_str', '0%').strip().replace('%', '')
                try:
                    job['percent'] = float(percent_str)
                except ValueError:
                    pass
                job['status'] = 'downloading'
            elif d['status'] == 'finished':
                job['percent'] = 100
    return hook


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/download', methods=['POST'])
def download():
    data = request.get_json(silent=True) or {}
    urls = data.get('urls', [])
    convert_to_mp3 = data.get('convert_to_mp3', True)

    if not urls:
        return jsonify({'error': 'No URLs provided'}), 400

    valid_urls = [url.strip() for url in urls if url.strip()]

    if len(valid_urls) > MAX_URLS_PER_REQUEST:
        return jsonify({'error': f'Max {MAX_URLS_PER_REQUEST} URLs per request.'}), 400

    invalid_urls = [url for url in valid_urls if not is_valid_youtube_url(url)]
    if invalid_urls:
        return jsonify({'error': 'Invalid YouTube URLs detected. Please provide valid YouTube links.'}), 400

    if not valid_urls:
        return jsonify({'error': 'No valid URLs provided'}), 400

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {'percent': 0, 'status': 'downloading'}

    try:
        file_paths, title, failed = download_audio(
            valid_urls,
            app.config['DOWNLOAD_FOLDER'],
            convert_to_mp3,
            progress_hook=make_progress_hook(job_id),
            max_urls=MAX_URLS_PER_REQUEST,
        )

        if not file_paths:
            with jobs_lock:
                jobs[job_id]['status'] = 'error'
            return jsonify({'error': 'Failed to download any videos. Please check the URLs and try again.'}), 500

        if len(file_paths) == 1:
            filename = os.path.basename(file_paths[0])
        else:
            zip_filename = f"YT-Music_{int(time.time())}.zip"
            zip_path = os.path.join(app.config['DOWNLOAD_FOLDER'], zip_filename)
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for file in file_paths:
                    if os.path.exists(file):
                        zipf.write(file, os.path.basename(file))
            filename = zip_filename
            title = f"{len(file_paths)} files"

        with jobs_lock:
            jobs[job_id]['status'] = 'done'
            jobs[job_id]['percent'] = 100

        response = {
            'success': True,
            'message': f'Download complete. Files saved to: {app.config["DOWNLOAD_FOLDER"]}',
            'filename': filename,
            'title': title,
            'job_id': job_id,
        }
        if failed:
            response['warnings'] = failed  # some URLs in the batch failed but others succeeded
        return jsonify(response)

    except Exception as e:
        with jobs_lock:
            if job_id in jobs:
                jobs[job_id]['status'] = 'error'
        print(f'Error during download: {str(e)}')
        return jsonify({'error': f'Download failed: {str(e)}'}), 500
    finally:
        # Clean up the job entry a bit later so a final progress poll can still read it.
        def cleanup():
            time.sleep(60)
            with jobs_lock:
                jobs.pop(job_id, None)
        threading.Thread(target=cleanup, daemon=True).start()


@app.route('/progress/<job_id>')
def progress(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Unknown job'}), 404
    return jsonify(job)


@app.route('/file/<filename>')
def serve_file(filename):
    # secure_filename strips path separators and other characters that
    # would otherwise allow escaping DOWNLOAD_FOLDER (path traversal).
    safe_name = secure_filename(filename)
    if not safe_name:
        return "Invalid filename", 400

    file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], safe_name)

    # Belt-and-suspenders: confirm the resolved path is still inside DOWNLOAD_FOLDER.
    if not os.path.abspath(file_path).startswith(os.path.abspath(app.config['DOWNLOAD_FOLDER'])):
        return "Invalid filename", 400

    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "File not found", 404


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    print('YT Music Downloader started')
    print(f'Files will be saved to: {DOWNLOADS_FOLDER}')
    print('Open your browser at: http://127.0.0.1:5000')
    app.run(debug=debug_mode, host='127.0.0.1', port=5000, threaded=True)