dojo.provide("dojox.widget.CodeTextArea");

dojo.require("dijit._Widget");
dojo.require("dojox.data.dom");
dojo.require("dijit._Templated");
dojo.require("dijit.form.ComboBox");

dojo.declare(
    "dojox.widget.CodeTextArea",
	[dijit._Widget, dijit._Templated],
    {
        templateString: 
        '<div class="dojoCodeTextArea" dojoAttachPoint="codeTextAreaContainer">'
            +'<div class="dojoCodeTextAreaHL" style="position:absolute;top:0;z-index:10" dojoAttachPoint="currentLineHighLight">'
                +'<div dojoAttachPoint="caret" style="position:absolute;top:0;left:0" class="dojoCodeTextAreaCaret">&nbsp;'
                +'</div>&nbsp;'
            +'</div>'
            +'<div class="dojoCodeTextAreaLines" dojoAttachPoint="lines"></div>'
        +'</div>',
        isContainer: true,

        // parameters
        height: 100,
        width: 800,
        // attach points
        currentLineHighLight: null,
        caret: null,
        // x: Integer
        x: 0,
        // y: Integer
        y: 0,
        plugins: "",
        // _caretWidth: Integer
        _caretWidth: 0,
        // _caretWidth: Integer
        _caretHeight: 0,
        /*boolean*/
        _specialKeyPressed: false,
        _clipboard: null,
        _range: null,
        codeTextAreaContainer: null,

        currentLine: null,
        currentToken: null,
        previousToken: null,
        caretIndex: 0,
        colorsUrl: "",
        autocompleteUrl: "",
        _caret: null,
        _command: 0,
        commands: {},
        autocompleteDictionary: {},
        colorsDictionary: {},
        _suggestionsPopup: null,
        _suggestionList: null,
        _suggestionsMenu: null,
        _suggestionBlocked: false,
        _keyUpHandler: null,
        _keyPressHandler: null,
        _eventHandlers: [],
        suggestionsCombo: null,
        _targetToken: null,
        _blockedKeyCombinations: {},
        _preventLoops: false,
        postCreate: function(){
            this.init();
            this.loadDictionary(this.autocompleteUrl, dojo.hitch(this, this._autocompleteFiller));
            this.loadDictionary(this.colorsUrl, dojo.hitch(this, this._colorsFiller));
            this.loadPlugins();
            this.setDimensions();
            this._initializeInternals();
            this._initializeDoc();
            this._initializeClipboard();
            this._initializeSuggestionsPopup();
            this._initializeRange();

            // initial status
            this._command = "";

            this.attachEvents();
            document.body.focus();
            dojo.connect(this.domNode, "onmouseup", this, "setCaretPositionAtPointer");
            dojo.connect(this.domNode, "onclick", this, "blur");
            this._caret = document.createElement("input");
            this._caret.type = "text";
            this._caret.name = "_caret";
            this._caret.style.position = "absolute";
            this._caret.style.display = "none";
            this._caret.style.top = "13px";
            this._caret.style.border = "1px solid red";
            this._caret.style.right = "500px";
            document.body.appendChild(this._caret);    
        },
        _initializeSuggestionsPopup: function(){
            var _comboNode = document.createElement("div");
            _comboNode.style.position = "absolute";
            _comboNode.style.top = "0";
            _comboNode.style.left = "0";
            _comboNode.style.display = "none";
            dojo.body().appendChild(_comboNode);
            var store = new dojo.data.ItemFileReadStore({url: this.autocompleteUrl });
            
            this.suggestionsCombo = new dijit.form.ComboBox({
				name: "suggestions",
				autoComplete: false,
				store: store,
                hasDownArrow: false,
				searchAttr: "name"
			}, _comboNode);
			this.suggestionsCombo.domNode.style.position = "absolute";
			this.suggestionsCombo.domNode.style.display = "none";
			this.suggestionsCombo.domNode.style.zIndex = "100";
            this.suggestionsCombo.textbox.style.display = "inline"; // added 10/03/2007
            dojo.connect(this.suggestionsCombo, "onkeyup", dojo.hitch(this, this.autocomplete));
            dojo.addClass(this.suggestionsCombo.textbox, "suggester");
        },
        _initializeInternals: function(){
            this.commands = {
                NONE: 0,
                PASTE: 1
            };
        },
        _initializeClipboard: function(){
            this._clipboard = document.createElement("textarea");
            this._clipboard.style.position = "absolute";
            this._clipboard.style.top = "-100px";
            this._clipboard.style.left = "-100px";
            this._clipboard.style.width = "0";
            this._clipboard.style.height = "0";
            document.body.appendChild(this._clipboard);
            console.debug("clipboard initialized");
        },
        init: function(){
            // initializations
            this.onLoad();
        },
        blur: function(){
            // to solve IE scroll problem; find another solution
//            document.body.focus();
        },
        
        loadDictionary: function(url, callBack){
            var _self = this;
            var getArgs = {
                url: url,
                sync: true,
                handleAs: "json-comment-optional"
            };
            var getHandler = dojo.xhrGet(getArgs);
            getHandler.addCallback(function(result) {
                dojo.hitch(_self, callBack(result));
            });
            getHandler.addErrback(function(err) { _self._dictionaryLoadError (err); });
        },
        _colorsFiller: function(data){
            this.colorsDictionary = data;
        },
        _autocompleteFiller: function(data){
            this.autocompleteDictionary = data;
        },
        _dictionaryLoadError: function(error){
            window.alert(error);
        },
        getLineLength: function(/*int*/ y){
            var line = this.lines.getElementsByTagName("div")[y];
            return line ? dojox.data.dom.textContent(line).length-1 : 0;
        },
        numLines: function(){
            return this.lines.getElementsByTagName("div").length;
        },
        execCommand: function(command){
            var cmd = this.commands;
            switch (command){
                case cmd.PASTE:
//                    this.paste(this._clipboard.value);
//                    this.writeFast();
                    this.massiveWrite(this._clipboard.value);
                break;
                default:
                break;
            }
            this._command = cmd.NONE;
        },
        paste: function(content){
            this.write(content, true);
        },
        keyUpHandler: function(evt){
            var cmd = this.commands;
            switch (this._command){
                case cmd.PASTE:
                    this.execCommand(this._command);
                break;
                default:
                break;
            }
        },
        _initializeRange: function(){
            this._range = document.createRange ? document.createRange() : null;
        },
        selectNode: function(node){
            // TODO
        },
        keyPressHandler: function(evt){
            if (this._preventLoops){
                this._preventLoops = false;
                return;
            }
            this._specialKeyPressed = true;//IE
            evt = dojo.fixEvent(evt||window.event);
            dojo.publish("CodeTextArea::KeyPressed", [{source:this,evt:evt}]);
            var keyCode = evt.keyCode;
            var charCode = evt.charCode;
//            console.debug("2-> charCode/keyCode: "+evt.charCode+"/"+evt.keyCode);
            var dk = dojo.keys;
            var x = this.x;
            var y = this.y;
            var lines = this.lines.getElementsByTagName("div");
            var resCode = charCode||keyCode;
            var cmd = this.commands;
            switch(resCode){
                case dk.ESCAPE:
                break;
                case dk.BACKSPACE:
                    // refactor! shared code with caret left...
                    if(!(x || y)){ return; }
                    if(x){
                       this.setCaretPosition(x-1, y);
                    }else if(y){
                       this.setCaretPosition(this.getLineLength(y-1), y-1);
                    }
                    this.removeCharAtCaret();
                break;
                case dk.DELETE:
                    if(charCode == dk.DELETE){ 
                        this._specialKeyPressed = false;
                        break; 
                    }
                    this.removeCharAtCaret();
                break;
                case dk.DOWN_ARROW:
                    if(charCode==0){
                        if(!lines[y + 1]){ return; }
                        lineLength = this.getLineLength(y+1);
                        this.setCaretPosition(x < lineLength ? x : lineLength, y+1);
                    }else{
                        // open round bracket (
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.LEFT_ARROW:
                    if(charCode==0){
                        if(x){
                           this.setCaretPosition(x-1, y);
                        }else if(y){
                           this.setCaretPosition(this.getLineLength(y-1), y-1);
                        }
                    }else{
                        // percent %
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.RIGHT_ARROW:
                    if(charCode==0){
                        if(x<this.getLineLength(y)){
                           this.setCaretPosition(x+1, y);
                        }else if(y<this.numLines()-1){
                            this.setCaretPosition(0, y+1);
                        }
                    }else{
                        // single quote '
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.UP_ARROW:
                    if(charCode==0){
                        if(y<1){ return; }
                        lineLength = this.getLineLength(y-1);
                        this.setCaretPosition(x < lineLength ? x : lineLength, y-1);
                    }else{
                        // ampersand &
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.HOME:
                    if(charCode==0){
                        this.setCaretPosition(0,this.y);
                    }else{
                        // dollar $
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.END:
                    if(charCode==0){
                        this.setCaretPosition(this.getLineLength(this.y),this.y);
                    }else{
                        // hash #
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.TAB:
                    this.writeTab();
                    dojo.stopEvent(evt);
//                    evt.preventDefault();
                break;
                case dk.CTRL:
                break;
                case dk.SHIFT:
                    break;// 
                case dk.ALT:
                    break;
                case dk.ENTER:
                    this.splitLineAtCaret();
                    break;
                case dk.LEFT_WINDOW:
                    break;
                case dk.RIGHT_WINDOW:
                    break;
                case 99: // c
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        // default browser action
                        return;
                    }
                break;
                case 118: // v
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        // ctrl + v
                        this._clipboard.value = "";
                        this._clipboard.focus();
                        this._command = cmd.PASTE;
                        this._specialKeyPressed = true;
                        return false;
                    }
                break;
                case 32: // space
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        this._suggestionBlocked = true;
                        this.detachEvents();
                        this.showSuggestions();
                    }
                break;
                default:
//                    var _ctrlPressed = evt.ctrlKey ? "CTRL+" : "";
//                    var _shiftPressed = evt.shiftKey ? "SHIFT+" : "";
//                    if(!this._blockedKeyCombinations[_ctrlPressed+_shiftPressed+String.fromCharCode(resCode)]){
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }
                break;
                
            }
            
            if(!this._specialKeyPressed){ 
//            if(this._caret.value.length!=0){ 
                this.write(String.fromCharCode(resCode), true); 
            }
            dojo.stopEvent(evt); // prevent default action (opera) // to TEST!
//            evt.preventDefault(); // prevent default action (opera)
        },
        writeTab: function(){
            // GRRR, correct the writeToken method!
            this.write("    ", true);
        },
        removeCharAtCaret: function(){
            var _currentToken = this.currentToken;
            var _previousTokenType = _currentToken.getAttribute("tokenType");
            if(this.y == this.numLines() - 1 && _previousTokenType == "line-terminator"){
                return;
            }
            var _content = _currentToken.firstChild.data;
            var _tokenSize = _content.length;
            if(_tokenSize > 1){
                _currentToken.firstChild.data = _content.substring(0,this.caretIndex) + 
                    _content.substring(this.caretIndex+1);
                this.colorizeToken(_currentToken);
            }else{
                _currentToken.parentNode.removeChild(_currentToken);
            }

            this.setCurrentToken();

            if(_previousTokenType == "line-terminator"){ 
                this.mergeLinesAtCaret(); 
            }
            _currentToken = this.currentToken;
            var _prevToken = _currentToken.previousSibling;
            if(_currentToken && _prevToken && _currentToken.getAttribute("tokenType") == _prevToken.getAttribute("tokenType")){
                this.mergeTokens(_prevToken, _currentToken);
                this.setCurrentToken();
                this.colorizeToken(this.currentToken);
            }
        },
        mergeLinesAtCaret: function(){
            var _currentLine = this.currentLine;
            var y = this.y;
            if(y<this.numLines()-1){
                var _nextLine = this.getLine(y+1);
                var _nextElement = _nextLine.firstChild;
                while(_nextElement){
                    _currentLine.appendChild(_nextElement);
                    _nextElement = _nextLine.firstChild;
                }
                _nextLine.parentNode.removeChild(_nextLine);
                
                this.setCurrentToken();
            }
        },
        mergeTokens: function(/*token*/ sourceToken, /*token*/ targetToken){
            targetToken.firstChild.data = sourceToken.firstChild.data + targetToken.firstChild.data;
            sourceToken.parentNode.removeChild(sourceToken);
        },
        getLine: function(/*int*/ y){
            return this.lines.getElementsByTagName("div")[y];
        },
        splitLineAtCaret: function(line){
            var _previousToken = this.currentToken.previousSibling;
            var _token =  this.currentToken;
            var _tokensToMove = [];
            while(_token){
                if(_token.getAttribute("tokenType")=="line-terminator"){ break; }
                _tokensToMove.push(_token);
                _token = _token.nextSibling;
            }
            if(this.caretIndex && _tokensToMove[0]){
                var caretIndex = this.caretIndex;
                var _initialContent = _tokensToMove[0].firstChild.data;
                var _tokenType = _tokensToMove[0].getAttribute("tokenType");
                _tokensToMove[0].firstChild.data = _initialContent.substring(0,caretIndex);
                this.colorizeToken(_tokensToMove[0]);
                _tokensToMove[0] = document.createElement("span");
                _tokensToMove[0].appendChild(document.createTextNode(_initialContent.substring(caretIndex)));
                _tokensToMove[0].setAttribute("tokenType", _tokenType);
                this.colorizeToken(_tokensToMove[0]);
            }
            // addNewLine() changes the currentToken
            var newLine = this.addNewLine();
            for(var i = 0; i < _tokensToMove.length; i++){
                dojo.place(_tokensToMove[i], newLine.lastChild, "before");
            }
            // put the caret on the next line
            this.setCaretPosition(0, this.y+1);
        },
        // TODO: find a better name for these methods
        moveCaretBy: function(/*int*/ x, /*int*/ y){
            this.setCaretPosition(this.x + x, this.y + y);
        },
        
        setCaretPosition: function(/*int*/ x, /*int*/ y){
            this.caret.style.left = x*this._caretWidth + "px";
            this.x = x;
            var _xPx = x*this._caretWidth;
            var _yPx = y*this._caretHeight;
            this.currentLineHighLight.style.top = _yPx + "px";
            this.y = y;
            
            this.setCurrentToken();
            this.colorizeToken(this.currentToken);
            // scroll
            // scrollHeight grows...
            var _yLim =_yPx + 2*this._caretHeight;
            if(_yLim >= this.height + this.domNode.scrollTop){
                this.domNode.scrollTop = _yLim - this.height;
            }else if(_yPx < this.domNode.scrollTop){
                this.domNode.scrollTop = _yPx;
            }

            // nr 20-06-2007 (06/20/2007) [added]
            this.currentLineHighLight.style.width = Math.max(this.width, this._caretWidth*(this.x+1)) + "px"; 
            var _xLim =_xPx + 3*this._caretWidth; // a computed value is better than 3...
            if(_xLim >= this.width/* + this.domNode.scrollLeft*/){
                this.domNode.scrollLeft = _xLim - this.width;
            }else if(_xPx < this.domNode.scrollLeft){
                this.domNode.scrollLeft = _xPx;
            }
            dojo.publish("CodeTextArea::CaretMove", [{x:x + 1,y:y + 1}]);
        },
        setCurrentToken: function(){
            // find the currentToken
            var x = this.x;
            this.currentLine = this.lines.getElementsByTagName("div")[this.y];
            var tokens = this.currentLine.getElementsByTagName("span");
            var lastChar = 0;
            var firstChar = 0;
            var tokensLength = tokens.length;
            for(var i = 0; i < tokensLength; i++){
                firstChar = lastChar;
                lastChar += tokens[i].firstChild.data.length;// + 1; 
                if(x < lastChar){
                    this.currentToken = tokens[i];
                    this.previousToken = i ? tokens[i-1] : null;
                    this.caretIndex = x - firstChar;
                    break;
                }
            }
        },
        getCaretPosition: function(){
            return {x: this.x, y: this.y};
        },
        onLoad: function(){
            this.codeTextAreaContainer.style.height = this.height + "px"; // height in lines
            this.codeTextAreaContainer.style.width = this.width + "px"; 
        },
        setDimensions: function(){
            this._caretWidth = dojo.contentBox(this.caret).w;
            this._caretHeight = dojo.contentBox(this.currentLineHighLight).h;
        },
        attachEvents: function(){
            var node = document;
//            var node = this._caret;
            
            this._eventHandlers.push(dojo.connect(node, "onkeypress", this, "keyPressHandler"));
            this._eventHandlers.push(dojo.connect(node, "onkeyup", this, "keyUpHandler"));
        },
        detachEvents: function(){
            for(var i = 0; i < this._eventHandlers.length; i++){
                dojo.disconnect(this._eventHandlers[i]);
            }
            this._eventHandlers.length = 0;
        },
        setCaretPositionAtPointer: function(e){
            var evt = dojo.fixEvent(e);
//            console.debug("evt.layerX: " + evt.layerX);
//            console.debug("evt.layerY: " + evt.layerY);
            var y = Math.min(parseInt(Math.max(0, evt.layerY) / this._caretHeight), this.numLines()-1);
            var x = Math.min(parseInt(Math.max(0, evt.layerX) / this._caretWidth), this.getLineLength(y));
            this.setCaretPosition(x, y);
        },
        createLine: function(){
            var newLine = document.createElement("div");
            newLine.className = "codeTextAreaLine";             
            newLine.style.height = this._caretHeight + "px";
            var _currentToken = this.createLineTerminator();
            newLine.appendChild(_currentToken);
            this.currentToken = _currentToken;
            return newLine;
        },
        writeLine: function(/*String*/ text, /*Boolean*/ moveCaret){
            if(!text){ return; }
//            var tokens = text.match(/\S+|\s+/g);            
            var tokens = text.match(/\.+|[\S+|\s+]/g);            
            var len = tokens.length;
            for(var i = 0; i < len; i++){
                var token = tokens[i];
                this.writeToken(token);
                if(moveCaret){ this.moveCaretBy(token.length, 0); }
            }
        },
        addNewLine: function(/*string*/ position){
            var lines = this.lines.getElementsByTagName("div");
            var newLine = this.createLine();
            if(position=="end"){
                this.lines.appendChild(newLine);
            }else{
                dojo.place(newLine, lines[this.y], "after");
            }
            return newLine;
        },
        write: function(/*String*/ text, /*Boolean*/ moveCaret){
//            var rows = text.split("\n");
            if(!text){ return; }
            var rows = text.split(/\n\r|\r\n|\r|\n/);
            for(var i = 0; i < rows.length; i++){
                var line;
                if(i){
                    this.splitLineAtCaret();
                }else{
                    line = this.currentLine;
                }
                if(moveCaret){ this.currentLine = line; }
                this.writeLine(rows[i], moveCaret);
            }
            if(moveCaret){this.setCaretPosition(this.x, this.y);}
        },
        createLineTerminator: function(){
              var terminatorToken = document.createElement("span");
              terminatorToken.setAttribute("tokenType", "line-terminator");
              terminatorToken.style.visibility="hidden";
//              terminatorToken.appendChild(document.createTextNode("\u00b6"));
//              terminatorToken.appendChild(document.createTextNode("\u000D")); <-- better solution, but IE...
              terminatorToken.appendChild(document.createTextNode("#"));

//              terminatorToken.appendChild(document.createTextNode(" "));
              return terminatorToken;
        },
        writeToken: function(/*String*/ content, /*Boolean*/ moveCaret, /*Boolean*/ substCaret){
            if(!content){ return; }

            // tokenType
            // find a way to add different token types!
//            var tokenType = content.charAt(0) == "." || content.charAt(0) == " " ? "separator" : "word"; 
            // parametrize this section [begin]
            var tokenType = "";
            var wrapper = "span";
            if(content.charAt(0) == "."){
                tokenType = "context-separator";
            }else if(content.charAt(0) == " "){
                tokenType = "separator";
            }else{
                tokenType = "word";
            }
            if(substCaret){
            	tokenType = "caret";
				wrapper = "i";
            }
            // parametrize this section [end]
            
            var currentToken = this.currentToken;
            var _previousCurrentToken = currentToken;
            var currentTokenType = currentToken.getAttribute("tokenType");
            
            // two main cases:
            if(this.caretIndex != 0){
                // *************************************************************
                // 1) in a token
                // *************************************************************
                if(tokenType == currentTokenType){// subcase 1: same token type
                    // in the currentToken
                    currentToken.replaceChild(
                        document.createTextNode(
                            currentToken.firstChild.data.substring(0,this.caretIndex)
                            + content + currentToken.firstChild.data.substring(this.caretIndex)
                        ), 
                        currentToken.firstChild
                    );
//                    if(moveCaret){ this.moveCaretBy(content.length, 0);}
                }else{// subcase 2: different types
                    var firstText = currentToken.firstChild.data.substring(0,this.caretIndex);
                    var lastText = currentToken.firstChild.data.substring(this.caretIndex);
                    if(firstText.length!=0){
                        // first token
                        var newToken = document.createElement("span");
                        newToken.appendChild(document.createTextNode(firstText));
                        newToken.setAttribute("tokenType", currentTokenType);
                        dojo.place(newToken, currentToken, "before");
                        
                        // inner token
                        var innerToken = document.createElement(wrapper);
                        innerToken.appendChild(document.createTextNode(content));
                        innerToken.setAttribute("tokenType", tokenType);
                        dojo.place(innerToken, currentToken, "before");
    
                        // last token
                        currentToken.replaceChild(document.createTextNode(lastText),
                            currentToken.firstChild);
                        currentToken.setAttribute("tokenType", currentTokenType);
    
                        this.currentToken = currentToken = innerToken;
//                        if(moveCaret){ this.moveCaretBy(content.length, 0); }
                    }
                }
            }else{
                // *************************************************************
                // 2) between two tokens
                // *************************************************************
                var _prev = this.currentToken.previousSibling;
                var _targetToken;
                if(_prev && _prev.getAttribute("tokenType") == tokenType){
                    _targetToken = _prev;
                    _targetToken.replaceChild(document.createTextNode(_targetToken.firstChild.data + content), _targetToken.firstChild);
                }else if(tokenType == currentTokenType/* || currentTokenType == ""*/){
                    
                    // if currentTokenType == "" => first (unique) token in this line
                    _targetToken = this.currentToken;
                    _targetToken.replaceChild(document.createTextNode(content + _targetToken.firstChild.data), _targetToken.firstChild);
                }else{
                    // create a new token
                    _targetToken = document.createElement(wrapper);
                    _targetToken.appendChild(document.createTextNode(content));
//                    _targetToken.innerHTML = content; // NOOOOOOOOOOOO! error on IE! :@
                    _targetToken.setAttribute("tokenType", tokenType);
                    if(_prev){
                        dojo.place(_targetToken, _prev, "after");
                    }else{
                        dojo.place(_targetToken, this.currentToken, "before");
                    }
                }
                this.currentToken = _targetToken;
//                if(moveCaret){ this.moveCaretBy(content.length, 0); }
            }
        },
        substCaretPosition: function(){
            this.writeToken("-", false, true); // params: token, moveCaret, fixCaret
        },
        massiveWrite: function(content){
            // find the caret position
            var _savedCurrentToken = this.currentToken;
            this.substCaretPosition();
//			window.alert(this.currentToken.firstChild.data);
            var _initialContent = this.lines.innerHTML;
            var _index = _initialContent.indexOf("<i");
            if(_index == -1){
            	_index = _initialContent.indexOf("<I"); // IE fix
            }
            this.currentToken.parentNode.removeChild(this.currentToken);
            var _initialContent = this.lines.innerHTML;

            var _firstFragment = _initialContent.substring(0, _index); // ARGH! ERROR IN IE
//            window.alert("index: " + _index)
            var _lastFragment = _initialContent.substring(_index);

            var _parsedContent = "";
//            var rows = content.split(/\n\r|\r\n|\r|\n/);
            var rows = content.split(/\n/);

            var tokens = [];            
			var cDict = this.colorsDictionary;
            for(var i = 0; i < rows.length; i++){
				//tokens = rows[i].match(/\W+|\w+/g);

				// START new solution 09-23-2007
				var row = rows[i];
				var _previousType = "";
				var _currentType = "";
				var _workingToken = "";
				var _rowText = "";

				if(i){
					_rowText = "<div class=\"codeTextAreaLine\" style=\"height: 16px\">";
				}
				for(var k = 0; k < row.length; k++){
					// token classification
					var _currentChar = row.charAt(k);
					// html START
					if(_currentChar == "&"){
						_currentChar = "&amp;";
					}else if(_currentChar == "\t"){
						_currentChar = "    ";
					}else if(_currentChar == "<"){
						_currentChar = "&lt;";
					}else if(_currentChar == ">"){
						_currentChar = "&gt;";
					}
					// html END
					if(_currentChar === "."){
						_currentType = "context-separator";
					}else if(_currentChar === " "){
						_currentChar = "&nbsp;";
						_currentType = "separator";
					}else{
						_currentType = "word";
					}
					
					// type controls

					if(_currentType === _previousType && k < row.length - 1){
						_workingToken += _currentChar;
//						console.debug("1: " + _workingToken);
					}else{ // type change or end of line
						if(_currentType === _previousType){
							_workingToken += _currentChar;
						}
//						console.debug("2: " + _workingToken);
						if(_previousType){
							var _class = (_workingToken in cDict) ? cDict[_workingToken].className : "";
							_rowText += "<span class=\"" + _class + "\" tokenType=\"" + _previousType + "\">" + _workingToken + "</span>";
						}
						_workingToken = _currentChar;
						_previousType = _currentType;
					}
				} // end current row
				if(i<rows.length-1){
					_rowText += "<span style=\"visibility:hidden\" tokenType=\"line-terminator\">#</span></div>";
				}
//				terminatorToken.appendChild(document.createTextNode("\u000D"));
				
				_parsedContent += _rowText;
				
				// END new solution 09-23-2007

            } // end rows cycle
            this.lines.innerHTML = _firstFragment + _parsedContent + _lastFragment;
			this.currentToken = _savedCurrentToken;
			this.setCurrentToken();
        },
        // handles the single token colorization
        colorizeToken: function(/*token*/ currentToken){
            var previousToken = currentToken.previousSibling;
            var cDict = this.colorsDictionary;
            if(previousToken){
                previousToken.className = previousToken.firstChild.data in cDict ? cDict[previousToken.firstChild.data].className : "";
                var ppreviousToken = previousToken.previousSibling;
                    if(ppreviousToken){
                        ppreviousToken.className = ppreviousToken.firstChild.data in cDict ? cDict[ppreviousToken.firstChild.data].className : "";
                    }
            }
            currentToken.className = currentToken.firstChild.data in cDict ? cDict[currentToken.firstChild.data].className : "";
        },
        showSuggestions: function(){

            var _currentContext = this.getCurrentContext();
            var _contextLength = _currentContext.length;       
            var _suggestions = this.autocompleteDictionary;

            var i = 0;
            while(i < _contextLength && _suggestions.children){
                _suggestions = _suggestions.children[_currentContext[i]];
                i++;
            }
            
            // try...catch fails the first time in FF + Firebug

            if(i < _contextLength || !_suggestions){ this._preventLoops = true; this.attachEvents(); return; } // IE loops! :O

            // display suggestions
            var _items = _suggestions.children; 
            if(!_items){ this._preventLoops = true; this.attachEvents(); return; }

            this.createPopup(_items);
        },
        createPopup: function(/* object literal */ items){
            var _items = [];
            for(var i in items){
                _items.push({ value: i, name: i });
            }
            
            this.suggestionsCombo.store = 
                new dojo.data.ItemFileReadStore({data: {identifier:this.widgetId, items:_items}});
            var _self = this;
            
            var _toComplete = "";
            var _targetToken = this.caret;
            if(this.currentToken.getAttribute("tokenType") == "word"){
                _targetToken = this.currentToken;
            }else if(this.currentToken.previousSibling && this.currentToken.previousSibling.getAttribute("tokenType") == "word"){
                _targetToken = this.currentToken.previousSibling;
                _toComplete = _targetToken.firstChild.data;                
            }
            if(_targetToken != this.caret){
                _toComplete = _targetToken.firstChild.data;
            }
            this._targetToken = _targetToken;
            this.suggestionsCombo.setDisplayedValue(_toComplete);
            this.suggestionsCombo.domNode.style.display = "block";
            dijit.placeOnScreenAroundElement(this.suggestionsCombo.domNode, _targetToken, {'TL' : 'TL', 'TR' : 'TR'});
            this.suggestionsCombo.focus();

            // bill: can you make _startSearch public? pleeeease! ^__^
            this.suggestionsCombo._startSearch(this.suggestionsCombo.getValue());
        },
        getCurrentContext: function(){
            return this.getContext(this.currentToken);
        },
        getContext: function(/*token*/ startToken){
            var _targetToken = this._getTargetToken(startToken);
            if(_targetToken){
                return this.getContext(_targetToken).concat([_targetToken.firstChild.data]);
            }else{
                return [];
            };
            
        },
        autocomplete: function(evt){
            evt = dojo.fixEvent(evt||window.event);
            var keyCode = evt.keyCode;
            var charCode = evt.charCode;
            var resCode = keyCode||charCode;
            var _targetToken = this._targetToken;
            if(resCode == dojo.keys.ENTER || resCode == dojo.keys.ESCAPE){
                this.suggestionsCombo.domNode.style.display = "none";
				this.suggestionsCombo.textbox.blur(); // Opera and Safari
                if(_targetToken != this.caret){
                    // move the caret after the .
                    var _yShift = this.caretIndex ? this.caretIndex : _targetToken.firstChild.data.length;  
                    this.moveCaretBy(-(_yShift), 0); // ERROR HERE!!!!!
                    _targetToken.firstChild.data = "";
                }
                this.write(this.suggestionsCombo.getValue(), true);
//                this.suggestionsCombo.setDisplayedValue("");
                this.suggestionsCombo.textbox.setAttribute("valuenow", "");
                this.attachEvents();
            }
        },
        loadPlugins: function(){
            var plugins = this.plugins.split(" ");
            for(var i = 0; i < plugins.length; i++){
                try{
                    if(plugins[i]){
                        dojo.require("dojox.widget._codeTextArea.plugins." + plugins[i]);
                        dojo.hitch(this, dojox.widget._codeTextArea.plugins[plugins[i]].startup)();
                    }
                }catch(error){
                    console.debug("plugin \"" + plugins[i] + "\" not found");
                }                
            }
        },
        /* private functions */
        _getTargetToken: function(/*token*/ startToken){
            /* REFACTOR THIS METHOD!! */
            var _previousToken = startToken.previousSibling;
            var _ppreviousToken = _previousToken ? _previousToken.previousSibling : null;
            var _pppreviousToken = _ppreviousToken ? _ppreviousToken.previousSibling : null;
            var _targetToken;
            // TODO: add constants for "word", "context-separator"...
            if(startToken.getAttribute("tokenType") == "word" && 
                _previousToken && _previousToken.getAttribute("tokenType") == "context-separator"
                && _ppreviousToken && _ppreviousToken.getAttribute("tokenType") == "word"){
                _targetToken = _ppreviousToken;
            }else if(_previousToken && _previousToken.getAttribute("tokenType") == "word" && 
                _ppreviousToken && _ppreviousToken.getAttribute("tokenType") == "context-separator"
                && _pppreviousToken && _pppreviousToken.getAttribute("tokenType") == "word"){
                _targetToken = _pppreviousToken;
            }else if(_previousToken && _previousToken.getAttribute("tokenType") == "context-separator" &&
                _ppreviousToken && _ppreviousToken.getAttribute("tokenType") == "word"){
                _targetToken = _ppreviousToken;
            }
            return _targetToken;
        },
        _initializeDoc: function(){
            var newLine = this.createLine();
            this.lines.appendChild(newLine);
            this.currentLine = newLine;
        }
    }
);