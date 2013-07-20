/**
 * This is the javascript controller for our mass image upload feature.
 * 
 * @author Joe Green
 * @package html5-image-upload-gui
 * @see {https://github.com/joegreen88/html5-image-upload-gui}
 */

function HIUG_Item(id, file, src, name) { // This is a class
    this.name = name;
    this.src = src;
    this.file = file;
    this.id = id;
    this.selected = false;
    this.category = null;
    this.description = null;
    this.resolved = false;
    this.getItemTemplateVars = function() {
        return {
            id: this.id,
            source: this.src,
            title: this.name,
            size: window.HIUG.bytesToReadable(this.file.size),
            type: this.file.type
        };
    };
    this.getCategoryName = function() {
        for (index in window.HIUG.categories) {
            if (window.HIUG.categories[index].val === this.category) {
                return window.HIUG.categories[index].name;
            }
        }
    };
    this.getCategoriesOptions = function() {
        var options = [];
        for (index in window.HIUG.categories) {
            var obj = {};
            obj.val = window.HIUG.categories[index].val;
            obj.name = window.HIUG.categories[index].name;
            if (window.HIUG.categories[index].val == this.category) {
                obj.selected = true;
            }
            else {
                obj.selected = false;
            }
            options.push(obj);
        }
        return options;
    };
    this.getTaggingTemplateVars = function() {
        vars = {};
        vars.imageNoun = this.name+', '+window.HIUG.bytesToReadable(this.file.size);
        vars.description = this.description;
        vars.selectDefault = (null === this.category) ? true : false;
        vars.categories = this.getCategoriesOptions();
        return vars;
    };
}

function MIU_ProgressBar( upperBound ) { // This is a class
    this.upperBound = parseInt(upperBound);
    this.progress = 0;
    this.percentage = 0;
    this.animateTime = 350;
    this.$bar = $('#mass_image_upload .upload_progress .bar');
    this.addProgress = function( progression ) {
        this.progress = this.progress + parseInt(progression);
        if (this.progress > this.upperBound) {
            this.progress = this.upperBound;
        }
        var percentage = this.percentage;
        this.percentage = Math.floor((this.progress*100)/this.upperBound);
        if (percentage !== this.percentage) {
            this.moveProgressBar();
        }
    };
    this.moveProgressBar = function() {
        this.$bar.css({width: this.percentage+'%'});
    };
    this.resetProgressBar = function() {
        this.$bar.css({width: 0});
    };
}

window.HIUG = {
    
    items : {},
    itemsToUpload : [],
    itemsAutoIncrement : 0,
    controlsActivated : 0,
    isLoading : false,
    isUploading : false,
    stopLoading : false,
    
    // uploadImages() vars
    uploadPointer : 0,
    uploadIntervalID : 0,
    uploadInterval : 750,
    uploadProgressBar : null,
    taggingRequired : false,
    serverTarget : 'upload.php',
    
    // handleFileInput() vars
    filePointer : 0,
    countFiles : 0,
    isReadingFiles : false,
    filesIntervalID : 0,
    filesInterval : 250,
    
    // addZipFileItems() vars
    isReadingZip : false,
    zipIntervalID : 0,
    unzipper : false,
    zipInterval : 250,
    
    countItemsSelected : 0,
    countItemsResolved : 0,
    countMessages : 0,
    maxMessages : 20,
    categories : [
        { val: 1, name: 'Category One' },
        { val: 2, name: 'Category Two' },
        { val: 3, name: 'Category Three' },
        { val: 4, name: 'Category Four' },
        { val: 5, name: 'Category Five' }
    ],
    validImageTypes : [
        'image/png', 'image/jpeg', 'image/gif'
    ],
    validImageExtensions : [
        'png', 'jpg', 'jpeg', 'gif'
    ],
    imageExtensionsTypesMap : {
        png : 'image/png',
        jpg : 'image/jpeg',
        jpeg : 'image/jpeg',
        gif : 'image/gif'
    },
    
    // get the name of a category from a value
    getCategoryName : function(val) {
        for (index in this.categories) {
            if (this.categories[index].val == val) {
            return this.categories[index].name;
            }
        }
    },
    
    // switch top left area to "loading" state
    turnLoadingOn : function() {
        $miu = $('#mass_image_upload');
        $miu.find('.upload_input').css('display', 'none');
        $miu.find('.upload_loading_image').css('display', 'block');
        window.HIUG.isLoading = true;
    },
    
    // switch top left area back to "file select" state
    turnLoadingOff : function() {
        if (this.filesIntervalID === 0 && this.zipIntervalID === 0) {
            $miu = $('#mass_image_upload');
            $miu.find('.upload_loading_image').css('display', 'none');
            $miu.find('.upload_input').css('display', 'block');
            window.HIUG.isLoading = false;
            $('a#stop_loading').addClass('label-important').text('STOP LOADING FILES');
        }
    },
    
    // switch top left area to "uploading" state
    turnUploadingOn : function() {
        $miu = $('#mass_image_upload');
        $miu.find('.upload_input').css('display', 'none');
        $miu.find('.upload_progress').css('display', 'block');
        window.HIUG.isUploading = true;
    },
    
    // switch top left area back to "file select" state
    turnUploadingOff : function() {
        if (this.uploadIntervalID === 0) {
            $miu = $('#mass_image_upload');
            $miu.find('.upload_progress').css('display', 'none');
            $miu.find('.upload_input').css('display', 'block');
            window.HIUG.isUploading = false;
        }
    },
    
    // stop further file loading
    stopLoadingInput : function() {
        if (!this.stopLoading) {
            $('#mass_image_upload a#stop_loading').removeClass('label-important').text('STOPPING...');
            this.stopLoading = true;
        }
    },
    
    // Send images in this.items to the server via AJAX
    uploadImages : function() {
        if (this.isUploading) {
            alert("Please wait for the current batch of uploads to finish before uploading more images.");
            return false;
        }
        if (this.isLoading) {
            alert("Please wait for the files to finish loading into the browser before uploading.");
            return false;
        }
        if ($.isEmptyObject(this.items)) {
            alert("There are no images to upload.");
            return false;
        }
        if (window.HIUG.taggingRequired && 0 >= this.countItemsResolved) {
            alert("Images require tagging.");
            return false;
        }
        window.HIUG.turnUploadingOn();
        for (id in window.HIUG.items) {
            if (window.HIUG.taggingRequired && !window.HIUG.items[id].resolved) {
                continue;
            }
            window.HIUG.itemsToUpload.push(id);
        }
        window.HIUG.uploadProgressBar = new MIU_ProgressBar(window.HIUG.itemsToUpload.length);
        this.uploadIntervalID = window.setInterval(function(){
            if (window.HIUG.isUploadingFile) {
                return;
            }
            window.HIUG.isUploadingFile = true;
            if (0 >= window.HIUG.itemsToUpload.length) {
                window.clearInterval(window.HIUG.uploadIntervalID);
                window.HIUG.uploadIntervalID = 0;
                window.HIUG.isUploadingFile = false;
                window.HIUG.turnUploadingOff();
                window.HIUG.uploadProgressBar.resetProgressBar();
                window.HIUG.uploadProgressBar = null;
                return;
            }
            var id = window.HIUG.itemsToUpload.shift();
            var item = window.HIUG.items[id];
            var formData = new FormData();
            formData.append('id', item.id);
            formData.append(item.id+'_'+item.name, item.file, item.name);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', window.HIUG.serverTarget, true);
            xhr.onload = function() {
                var data = JSON.parse(this.responseText);
                window.HIUG.removeItem(parseInt(data.id), false);
                $('#miu-item_'+data.id).fadeOut('fast');
                window.HIUG.message('<strong>'+item.name+'</strong> uploaded successfully.', 'success');
                window.HIUG.uploadProgressBar.addProgress(1);
                window.HIUG.isUploadingFile = false;
            };
            xhr.send(formData);
        }, window.HIUG.uploadInterval);
    },
    
    // responds to the file upload field's onchange event
    handleFileInput : function() {
        this.countFiles = document.getElementById("upload_input").files.length;
        window.HIUG.turnLoadingOn();
        this.filesIntervalID = window.setInterval(function(){
            if (window.HIUG.isReadingFiles || window.HIUG.isReadingZip) {
                return;
            }
            window.HIUG.isReadingFiles = true;
            var i = window.HIUG.filePointer;
            window.HIUG.filePointer++;
            if (window.HIUG.stopLoading || window.HIUG.filePointer > window.HIUG.countFiles) {
                window.HIUG.isReadingFiles = false;
                window.HIUG.filePointer = 0;
                window.HIUG.countFiles = 0;
                clearInterval(window.HIUG.filesIntervalID);
                window.HIUG.filesIntervalID = 0;
                window.HIUG.turnLoadingOff();
                $('#mass_image_upload .list_body_outer').animate({
                    scrollTop: $('#mass_image_upload .list_body_outer')[0].scrollHeight
                }, 1000);
                window.HIUG.stopLoading = false;
                return;
            }
            var file = document.getElementById("upload_input").files[i];
            if ('application/x-zip-compressed' === file.type) {
                oFReader = new FileReader();
                oFReader.onload = function(oFREvent) {
                    if (!window.HIUG.addZipFileItems(file, oFREvent.target.result, file.name)) {
                        window.HIUG.message('The zip file <strong>'+file.name+'</strong> can\'t be opened.', 'warning');
                    }
                    window.HIUG.isReadingFiles = false;
                };
                oFReader.readAsBinaryString(file);
            }
            else if (window.HIUG.validImageTypes.indexOf(file.type) === -1) {
                window.HIUG.message('<strong>'+file.name+'</strong> is not a valid image file.', 'error');
                window.HIUG.isReadingFiles = false;
                return;
            }
            else {
                oFReader = new FileReader();
                oFReader.onload = function(oFREvent) {
                    if (window.HIUG.addItem(file, oFREvent.target.result, file.name)) {
                        window.HIUG.message('<strong>'+file.name+'</strong> was added to the queue.', 'info');
                    }
                    window.HIUG.isReadingFiles = false;
                };
                oFReader.readAsDataURL(file);
            }
        }, window.HIUG.filesInterval);
    },
    
    // Open a zip file, unzip it, find images and add those
    addZipFileItems : function(file, fileSrc, zipname) {
        if (false !== this.unzipper) {
            return; // something is already happening here
        }
        this.unzipper = new JSUnzip(fileSrc);
        if (!this.unzipper.isZipFile()) {
            this.unzipper = false;
            return false;
        }
        this.zipIntervalID = window.setInterval(function(){
            if (window.HIUG.isReadingZip) {
                return;
            }
            window.HIUG.isReadingZip = true;
            var entry = window.HIUG.unzipper.getEntry();
            if (window.HIUG.stopLoading || false === entry) {
                clearInterval(window.HIUG.zipIntervalID);
                window.HIUG.zipIntervalID = 0;
                window.HIUG.unzipper = false;
                window.HIUG.isReadingZip = false;
                window.HIUG.turnLoadingOff();
                window.HIUG.stopLoading = false;
                return;
            }
            if (-1 === [0, 8].indexOf(entry.compressionMethod)) {
                window.HIUG.isReadingZip = false;
                return; // unsupported compression method; continue.
            }
            var fileNameParts = entry.fileName.split('/');
            var fileName = fileNameParts[fileNameParts.length-1];
            fileNameParts = fileName.split('.');
            var fileExtension = fileNameParts[fileNameParts.length-1];
            if (-1 === window.HIUG.validImageExtensions.indexOf(fileExtension.toLowerCase())) {
                window.HIUG.isReadingZip = false;
                return; // this is not a valid image file; skip it.
            }
            var uncompressed = '';
            if (0 === entry.compressionMethod) {
                uncompressed = entry.data;
            }
            else if (8 === entry.compressionMethod) {
                uncompressed = JSInflate.inflate(entry.data);
            }
            entry = null;
            var dataType = window.HIUG.imageExtensionsTypesMap[fileExtension];
            var base64 = window.btoa(uncompressed);
            uncompressed = null;
            var fileSrc = "data:"+dataType+";base64,"+base64; // THIS WORKS
            var buffer = base64ToArrayBuffer(base64);
            base64 = null;
            var blob = new Blob([buffer], {type: dataType});
            if (window.HIUG.addItem(blob, fileSrc, fileName)) {
                window.HIUG.message('<strong>'+fileName+'</strong> was added to the queue from <em>'+zipname+'</em>');
            }
            window.HIUG.isReadingZip = false;
        }, window.HIUG.zipInterval);
        return true;
    },
    
    // Add an item to the queue using the file argument
    addItem : function(file, fileSrc, filename) {
        this.itemsAutoIncrement = this.itemsAutoIncrement + 1;
        var item = new HIUG_Item(this.itemsAutoIncrement, file, fileSrc, filename);
        this.items['item_'+this.itemsAutoIncrement] = item;
        var source = $("#tpl-item").html();
        var template = Handlebars.compile(source);
        var html = template(item.getItemTemplateVars());
        $(html).appendTo($('#mass_image_upload .list_body'));
        this.activateControls();
        return true;
    },
    
    // Remove an item from the queue
    removeItem : function(id) {
        if ('number' === typeof id) {
            id = 'item_'+id;
        }
        if (id in this.items) {
            if (id in this.itemsToUpload) {
                alert("Cannot remove: an upload is currently in progress for this image.");
                return false;
            }
            var imageName = this.items[id].name;
            if (this.items[id].selected) {
                this.countItemsSelected--;
            }
            if (this.items[id].resolved) {
                this.countItemsResolved--;
            }
            delete this.items[id];
            if (arguments.length == 1 || arguments[1] === true) {
                this.message('<strong>'+imageName+'</strong> was removed from the queue.', 'warning');
            }
        }
        if ($.isEmptyObject(this.items)) {
            this.disableControls();
        }
    },
    
    // Give an item the selected state
    selectItem : function(id) {
        var idstring = ('number' === typeof id) ? 'item_'+id : id;
        if (this.items[idstring].selected) {
            return;
        }
        this.items[idstring].selected = true;
        $('#mass_image_upload #miu-'+idstring).addClass('selected')
        .find('button.selection').html('<i class="icon-remove"></i>');
        this.countItemsSelected++;
    },
    
    // Give all items the selected state
    selectAllItems : function() {
        for (index in this.items) {
            this.selectItem(index);
        }
    },
    
    // Remove an item's selected state
    deselectItem : function(id) {
        var idstring = ('number' === typeof id) ? 'item_'+id : id;
        if (!this.items[idstring].selected) {
            return;
        }
        this.items[idstring].selected = false;
        $('#mass_image_upload #miu-'+idstring).removeClass('selected')
        .find('button.selection').html('<i class="icon-ok"></i>');
        this.countItemsSelected--;
    },

    // Remove the selected atstate from all selected items
    deselectAllItems : function() {
        for (index in this.items) {
            this.deselectItem(index);
        }
    },
    
    // Change an item's selected state
    selectionToggleItem : function(id) {
        var idstring = ('number' === typeof id) ? 'item_'+id : id;
        if (this.items[idstring].selected) {
            this.deselectItem(idstring);
        }
        else {
            this.selectItem(idstring);
        }
    },
    
    // Remove selected state from all resolved items and give selected state to all unresolved items
    selectAllUntaggedItemsOnly : function() {
        this.deselectAllItems();
        for (index in this.items) {
            if (!this.items[index].resolved) {
            this.selectItem(index);
            }
        }
    },
    
    // resolve an item by filling out the form in the modal dialogue
    tagItem : function(id) {
        var idstring = ('number' === typeof id) ? 'item_'+id : id;
        var item = this.items[idstring];
        var source = $("#tpl-tagging").html();
        var template = Handlebars.compile(source);
        var html = template(item.getTaggingTemplateVars());
        $('#mass_image_upload #tagging-dialogue').html(html).modal();
        $('#mass_image_upload #tagging-dialogue')
        .find('button#confirm-fields').on('click', function(){
            var category = $('#mass_image_upload #tagging-dialogue #category_field').val();
            var description = $('#mass_image_upload #tagging-dialogue #description_field').val();
            if ('' == description || '' == category) {
                alert('Category and Description are required, amend and try again.');
                return;
            }
            item.category = category;
            item.description = description;
            item.resolved = true;
            window.HIUG.countItemsResolved++;
            var itemNode = $('#mass_image_upload .item#miu-item_'+item.id);
            itemNode.addClass('resolved').find('img').attr('title', item.description);
            itemNode.find('button.expand').html('<i class="icon-tags"></i>');
            var msg = '<strong>'+item.name+'</strong> was tagged with category <em>'+window.HIUG.getCategoryName(category)+'</em> and description <em>'+description+'</em>.';
            window.HIUG.message(msg, 'info');
            $.modal.close();
            $('#mass_image_upload #tagging-dialogue').html('');
        });
    },
    
    // resolve the set of selected items by filling out the form in the modal dialogue
    tagSelectedItems : function() {
        if (0 >= this.countItemsSelected) {
            alert('Select some images first!');
            return false;
        }
        var vars = {
            imageNoun: 'Images',
            selectDefault: true,
            description: '',
            categories: []
        };
        for (index in this.categories) {
            var obj = {
            val: this.categories[index].val,
            name: this.categories[index].name,
            selected: false
            };
            vars.categories.push(obj);
        }
        var source = $("#tpl-tagging").html();
        var template = Handlebars.compile(source);
        var html = template(vars);
        $('#mass_image_upload #tagging-dialogue').html(html).modal();
        $('#mass_image_upload #tagging-dialogue')
        .find('button#confirm-fields').on('click', function(){
            var category = $('#mass_image_upload #tagging-dialogue #category_field').val();
            var description = $('#mass_image_upload #tagging-dialogue #description_field').val();
            if ('' == description || '' == category) {
                alert('Category and Description are required, amend and try again.');
                return;
            }
            var itemNames = [];
            for (index in window.HIUG.items) {
                if (!window.HIUG.items[index].selected) {
                    continue;
                }
                window.HIUG.items[index].category = category;
                window.HIUG.items[index].description = description;
                window.HIUG.items[index].resolved = true;
                window.HIUG.countItemsResolved++;
                var itemNode = $('#mass_image_upload .item#miu-item_'+window.HIUG.items[index].id);
                itemNode.addClass('resolved').find('img').attr('title', window.HIUG.items[index].description);
                itemNode.find('button.expand').html('<i class="icon-tags"></i>');
                itemNames.push(window.HIUG.items[index].name);
            }
            var lastItemName = itemNames.slice(-1);
            var firstItemNames = itemNames.slice(0, itemNames.length - 1);
            var msg = '<strong>'+firstItemNames.join(', ')+' and '+lastItemName[0]+'</strong> were tagged with category <em>'+window.HIUG.getCategoryName(category)+'</em> and description <em>'+description+'</em>.';
            window.HIUG.message(msg, 'info');
            $.modal.close();
            $('#mass_image_upload #tagging-dialogue').html('');
        });
    },
    
    // show controls
    activateControls : function() {
        if (0 === this.controlsActivated) {
            $('#mass_image_upload .control_bar').fadeIn('slow');
            this.controlsActivated = 1;
        }
    },
    
    // hide controls
    disableControls : function() {
        if (1 === this.controlsActivated) {
            $('#mass_image_upload .control_bar').fadeOut('fast');
            this.controlsActivated = 0;
        }
    },
    
    // Convert something like 1089 into something like 1 KB (works up to MB)
    bytesToReadable : function(bytes) {
        if (bytes >= 1024) {
            var kb = Math.floor(bytes / 1024);
            if (kb >= 1024) {
                var mb = Math.floor(kb / 1024);
                kb = kb - (mb * 1024);
                decimal = Math.floor((kb / 1024) * 100);
                return mb+'.'+kb+' MB';
            }
            else {
                return kb+ " KB";
            }
        }
        else {
            return bytes+" B";
        }
    },
    
    // Send a message to the user interface
    message : function( message ) {
        var msgType = 'misc';
        var msgClass = 'info';
        if (arguments.length > 1) {
            msgClass = arguments[1];
        }
        if (arguments.length > 2) {
            msgType = arguments[2];
        }
        var source = $("#tpl-message").html();
        var template = Handlebars.compile(source);
        var html = template({ message: message, msgClass: msgClass });
        var messagesNode = $('#mass_image_upload div.messages');
        $(html).prependTo(messagesNode);
        this.countMessages++;
        if (this.countMessages > this.maxMessages) {
            messagesNode.children('div.alert:last').remove();
            this.countMessages--;
        }
    }
    
};

$(document).ready(function(){
    $('#mass_image_upload #upload_input').on('change', function(){
        window.HIUG.handleFileInput();
    });
    $('#mass_image_upload').on('click', 'a#stop_loading', function(){
        window.HIUG.stopLoadingInput();
    });
    $('#mass_image_upload').on('click', '.item button.remove', function() {
	if (confirm('Remove this image from the queue?')) {
	    window.HIUG.removeItem($(this).data('itemid'));
	    $(this).closest('.item').remove();
	}
    });
    $('#mass_image_upload').on('click', '#upload_CTA', function(){
        window.HIUG.uploadImages();
    });
    $('#mass_image_upload .item').css('cursor', 'pointer').on('click', function(){
        window.HIUG.expandItem($(this).data('itemid'));
    });
    $('#mass_image_upload').on('click', '.item button.selection', function(){
        window.HIUG.selectionToggleItem($(this).data('itemid'));
    });
    $('#mass_image_upload').on('click', '.item button.expand', function(){
        window.HIUG.tagItem($(this).data('itemid'));
    });
    $('#mass_image_upload').on('click', 'button.select-all', function(){
        window.HIUG.selectAllItems();
    });
    $('#mass_image_upload').on('click', 'button.select-none', function(){
        window.HIUG.deselectAllItems();
    });
    $('#mass_image_upload').on('click', 'button.select-untagged', function(){
        window.HIUG.selectAllUntaggedItemsOnly();
    });
    $('#mass_image_upload').on('click', 'button.tag-selected', function(){
        window.HIUG.tagSelectedItems();
    });
});

/**
 * @see {https://github.com/niklasvh/base64-arraybuffer}
 */
function base64ToArrayBuffer(base64) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }
    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);
    for (i = 0; i < len; i+=4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i+1]);
      encoded3 = chars.indexOf(base64[i+2]);
      encoded4 = chars.indexOf(base64[i+3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
    return arraybuffer;
  }