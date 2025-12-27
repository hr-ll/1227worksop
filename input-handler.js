// 多模态输入处理（图片/音频/视频/文本）
class InputHandler {
    constructor() {
        this.currentInputType = 'image';
        this.files = {
            image: [],
            audio: null,
            video: null,
        };
        this.textContent = '';
        this.init();
    }

    init() {
        this.setupInputTabs();
        this.setupFileInputs();
        this.setupTextInput();
        this.setupDragAndDrop();
    }

    setupInputTabs() {
        const inputTabs = document.querySelectorAll('.input-tab');
        const inputPanels = document.querySelectorAll('.input-panel');

        inputTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const inputType = tab.dataset.inputType;
                this.switchInputType(inputType);
            });
        });
    }

    switchInputType(type) {
        this.currentInputType = type;

        // 更新标签状态
        document.querySelectorAll('.input-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.inputType === type);
        });

        // 更新面板显示
        document.querySelectorAll('.input-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `input-${type}`);
        });

        // 更新分析按钮状态
        this.updateAnalyzeButton();
    }

    setupFileInputs() {
        // 图片输入
        const imageInput = document.getElementById('image-input');
        const imageUploadArea = document.getElementById('image-upload-area');
        
        imageInput?.addEventListener('change', (e) => {
            this.handleImageFiles(e.target.files);
        });

        imageUploadArea?.addEventListener('click', () => {
            imageInput?.click();
        });

        // 音频输入
        const audioInput = document.getElementById('audio-input');
        const audioUploadArea = document.getElementById('audio-upload-area');
        
        audioInput?.addEventListener('change', (e) => {
            this.handleAudioFile(e.target.files[0]);
        });

        audioUploadArea?.addEventListener('click', () => {
            audioInput?.click();
        });

        // 视频输入
        const videoInput = document.getElementById('video-input');
        const videoUploadArea = document.getElementById('video-upload-area');
        
        videoInput?.addEventListener('change', (e) => {
            this.handleVideoFile(e.target.files[0]);
        });

        videoUploadArea?.addEventListener('click', () => {
            videoInput?.click();
        });
    }

    setupTextInput() {
        const textInput = document.getElementById('text-input');
        textInput?.addEventListener('input', (e) => {
            this.textContent = e.target.value;
            this.updateAnalyzeButton();
        });
    }

    setupDragAndDrop() {
        // 图片拖拽
        const imageUploadArea = document.getElementById('image-upload-area');
        this.setupDragDrop(imageUploadArea, (files) => {
            this.handleImageFiles(files);
        });

        // 音频拖拽
        const audioUploadArea = document.getElementById('audio-upload-area');
        this.setupDragDrop(audioUploadArea, (files) => {
            if (files[0]) this.handleAudioFile(files[0]);
        });

        // 视频拖拽
        const videoUploadArea = document.getElementById('video-upload-area');
        this.setupDragDrop(videoUploadArea, (files) => {
            if (files[0]) this.handleVideoFile(files[0]);
        });
    }

    setupDragDrop(element, callback) {
        if (!element) return;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.style.borderColor = 'var(--primary-color)';
        });

        element.addEventListener('dragleave', () => {
            element.style.borderColor = 'var(--border-color)';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.style.borderColor = 'var(--border-color)';
            const files = e.dataTransfer.files;
            callback(files);
        });
    }

    handleImageFiles(fileList) {
        const maxFiles = 5;
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        Array.from(fileList).forEach(file => {
            if (this.files.image.length >= maxFiles) {
                alert(`最多只能上传${maxFiles}张图片`);
                return;
            }

            if (!allowedTypes.includes(file.type)) {
                alert('不支持的图片格式，请使用 JPG、PNG、GIF 或 WebP');
                return;
            }

            if (file.size > maxSize) {
                alert('图片大小不能超过10MB');
                return;
            }

            this.files.image.push(file);
        });

        this.updateImagePreview();
        this.updateAnalyzeButton();
    }

    handleAudioFile(file) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm'];

        if (!allowedTypes.includes(file.type)) {
            alert('不支持的音频格式，请使用 MP3 或 WAV');
            return;
        }

        if (file.size > maxSize) {
            alert('音频文件大小不能超过50MB');
            return;
        }

        this.files.audio = file;
        this.updateAudioPreview();
        this.updateAnalyzeButton();
    }

    handleVideoFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = ['video/mp4', 'video/webm'];

        if (!allowedTypes.includes(file.type)) {
            alert('不支持的视频格式，请使用 MP4 或 WebM');
            return;
        }

        if (file.size > maxSize) {
            alert('视频文件大小不能超过100MB');
            return;
        }

        this.files.video = file;
        this.updateVideoPreview();
        this.updateAnalyzeButton();
    }

    updateImagePreview() {
        const previewContainer = document.getElementById('image-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        this.files.image.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = file.name;
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = '×';
                removeBtn.onclick = () => {
                    this.files.image.splice(index, 1);
                    this.updateImagePreview();
                    this.updateAnalyzeButton();
                };

                previewItem.appendChild(img);
                previewItem.appendChild(removeBtn);
                previewContainer.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
    }

    updateAudioPreview() {
        const previewContainer = document.getElementById('audio-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        if (this.files.audio) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = URL.createObjectURL(this.files.audio);
            
            const info = document.createElement('div');
            info.textContent = this.files.audio.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => {
                this.files.audio = null;
                this.updateAudioPreview();
                this.updateAnalyzeButton();
            };

            previewItem.appendChild(audio);
            previewItem.appendChild(info);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        }
    }

    updateVideoPreview() {
        const previewContainer = document.getElementById('video-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        if (this.files.video) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const video = document.createElement('video');
            video.controls = true;
            video.src = URL.createObjectURL(this.files.video);
            video.style.width = '100%';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => {
                this.files.video = null;
                this.updateVideoPreview();
                this.updateAnalyzeButton();
            };

            previewItem.appendChild(video);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        }
    }

    updateAnalyzeButton() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (!analyzeBtn) return;

        let hasInput = false;

        switch (this.currentInputType) {
            case 'image':
                hasInput = this.files.image.length > 0;
                break;
            case 'audio':
                hasInput = this.files.audio !== null;
                break;
            case 'video':
                hasInput = this.files.video !== null;
                break;
            case 'text':
                hasInput = this.textContent.trim().length > 0;
                break;
        }

        analyzeBtn.disabled = !hasInput;
    }

    getInputData() {
        return {
            type: this.currentInputType,
            files: {
                image: this.files.image,
                audio: this.files.audio,
                video: this.files.video,
            },
            text: this.textContent,
        };
    }

    clear() {
        this.files = {
            image: [],
            audio: null,
            video: null,
        };
        this.textContent = '';
        document.getElementById('text-input').value = '';
        this.updateImagePreview();
        this.updateAudioPreview();
        this.updateVideoPreview();
        this.updateAnalyzeButton();
    }
}

// 创建全局输入处理器实例
window.inputHandler = new InputHandler();

