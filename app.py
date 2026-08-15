from flask import Flask, render_template, request, jsonify, send_file
import os
import zipfile
import time
from models.downloader import download_audio

app = Flask(__name__)
app.config['DOWNLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__name__)), 'downloads')

# Ensure download folder exists
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    urls = data.get('urls', [])
    convert_to_mp3 = data.get('convert_to_mp3', True)
    
    if not urls:
        return jsonify({'error': 'No URLs provided'}), 400
        
    try:
        # Pass the URLs and the download folder to the model
        file_paths, title = download_audio(urls, app.config['DOWNLOAD_FOLDER'], convert_to_mp3)
        
        if not file_paths:
            return jsonify({'error': 'No se pudo descargar ningún video.'}), 500

        if len(file_paths) == 1:
            filename = os.path.basename(file_paths[0])
        else:
            # Create a zip file
            zip_filename = f"Descargas_{int(time.time())}.zip"
            zip_path = os.path.join(app.config['DOWNLOAD_FOLDER'], zip_filename)
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for file in file_paths:
                    if os.path.exists(file):
                        zipf.write(file, os.path.basename(file))
            filename = zip_filename
            title = f"{len(file_paths)} canciones (.zip)"
        return jsonify({
            'success': True,
            'message': 'Download complete',
            'filename': filename,
            'title': title
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file/<filename>')
def serve_file(filename):
    file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "File not found", 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
