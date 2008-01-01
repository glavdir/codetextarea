dojo.provide("dojox.widget.CodeTextArea");

dojo.require("dijit._editor.selection");
dojo.require("dijit._editor.range");

dojo.require("dijit._Widget");

// replace dojox.data.dom.textContent
dojo.require("dojox.data.dom");
dojo.require("dijit._Templated");
dojo.require("dijit.form.ComboBox");

dojo.declare(
    "dojox.widget.CodeTextArea",
	[dijit._Widget, dijit._Templated],
    {
		templatePath: dojo.moduleUrl("dojox.widget", "CodeTextArea/CodeTextArea.html"),
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
        linesCollection: null,

        currentLine: null,
        currentToken: null,
        lastToken: null,
        caretIndex: 0,
        lastCaretIndex: 0,
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
        _undoStack: [],
        _redoStack: [],
        _symbols: [
        	{"." : "context-separator"},
        	{" " : "separator"},
        	{"(" : "parenthesis"},
        	{")" : "parenthesis"},
        	{"[" : "parenthesis"},
        	{"]" : "parenthesis"},
        	{"{" : "parenthesis"},
        	{"}" : "parenthesis"}
        ],
        postCreate: function(){
            this.loadDictionary(this.autocompleteUrl, dojo.hitch(this, this._autocompleteFiller));
            this.loadDictionary(this.colorsUrl, dojo.hitch(this, this._colorsFiller));
            this.linesCollection = this.lines.getElementsByTagName("pre");
            this.loadPlugins();
            this.setDimensions();
            this._initializeInternals();
            this._initializeDoc();
            this._initializeClipboard();
            this._initializeSuggestionsPopup();
            this._initializeRange();
			this._addRowNumber({rows:100});
	    	dojo.subscribe(this.id + "::addNewLine", dojo.hitch(this, this._addRowNumber));

            // initial status
            this._command = "";

            this.attachEvents();
            document.body.focus();
            dojo.connect(this.domNode, "onmouseup", this, "setCaretPositionAtPointer");
            dojo.connect(this.domNode, "onclick", this, "blur");
            // this._caret: a little trick for Opera...
            this._caret = document.createElement("input");
            this._caret.type = "text";
            this._caret.name = "_caret";
            this._caret.style.position = "absolute";
            this._caret.style.display = "none";
            this._caret.style.top = "13px";
            this._caret.style.border = "1px solid red";
            this._caret.style.right = "500px";
            this.setCaretPosition(0, 0); 
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
                PASTE: 1,
                SELECTALL: 5,
                CLEARSELECTION: 5
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
        blur: function(){
            // to solve IE scroll problem; find another solution
//            document.body.focus();
        },
        
        loadDictionary: function(url, callBack){
            var _self = this;
            var getArgs = {
                url: url,
                sync: true,
                handleAs: "json-comment-optional",
                error: function(err){
                	_self._dictionaryLoadError(err)
                },
                load: function(result){
                	dojo.hitch(_self, callBack(result));
            	}
            };
            dojo.xhrGet(getArgs);
        },
        _colorsFiller: function(data){
        	var cDict = {};
        	for(var i in data){
        		var keys = i.split("|");
        		for(var j = 0, k = keys.length; j < k; j++){
        			cDict[keys[j]] = {};
        			cDict[keys[j]].className = data[i].className;
        		}
        	}
            this.colorsDictionary = cDict;
        },
        _autocompleteFiller: function(data){
            this.autocompleteDictionary = data;
        },
        _dictionaryLoadError: function(error){
            window.alert(error);
        },
        getLineLength: function(/*int*/ y){
            var line = this.linesCollection[y];
            return line ? dojox.data.dom.textContent(line).length-1 : 0;
        },
        numLines: function(){
            return this.linesCollection.length;
        },
        execCommand: function(command){
            var cmd = this.commands;
            switch (command){
                case cmd.PASTE:
//                    this.paste(this._clipboard.value);
//                    this.writeFast();
					this.detachEvents();
                    this.massiveWrite(this._clipboard.value);
                    this.attachEvents();
                break;
                case cmd.SELECTALL:
	                if(this.lines.firstChild){
	                	var r = this._range;
						r.setStartBefore(this.lines.firstChild);
						r.setEndAfter(this.lines.lastChild);
						this.selectRange(r);
					}
                break;
                case cmd.CLEARSELECTION:
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
        setSelectionStart: function(/*node*/node, /*integer*/position){
        },
        setSelectionEnd: function(/*node*/node, /*integer*/position){
        },
        selectRange: function(/*range*/ r){
			// from dijit._editor.selection
			var _document = dojo.doc;
			if(_document.selection && dojo.body().createTextRange){ // IE
				r._select(); //mmmpf, private method
			}else if(dojo.global["getSelection"]){
				var selection = dojo.global.getSelection();
				// FIXME: does this work on Safari?
				if(selection["removeAllRanges"]){ // Mozilla
					//var range = _document.createRange() ;
					//range.selectNode(element);
					selection.removeAllRanges();
					selection.addRange(r) ;
				}
			}
        	
        },
        _initializeRange: function(){
//            this._range = document.createRange ? document.createRange() : null;
//dojo.body().createControlRange() for IE?
            //this._range = dojo.doc.createRange ? dojo.doc.createRange() : dijit.range.create();
            this._range = dijit.range.create();
            console.debug("range created");
            var str = "";
            var ta = document.createElement("textarea");
            ta.id="tatest";
            ta.style.height = "300px";
            document.body.appendChild(ta);
            for(var i in this._range){
            	//console.debug(i);
	            ta.value += i + "\n";
            }
        },
        getSelection: function(){
        	return dijit._editor.selection;
        },
        getSelectedText: function(){
			return dijit._editor.selection.getSelectedText();
        },
        getSelectedHtml: function(){
			return dijit._editor.selection.getSelectedHtml();
        },
        selectNode: function(node){
            // TODO
        },
        clearSelection: function(){
			var _document = dojo.doc;
			var r = this._range;
			if(_document.selection && dojo.body().createTextRange){ // IE
				//window.alert(r.deleteContents);
				//dojo.doc.selection.clear(); // remove from document!
				//r.deleteContents();
				//r.collapsed = true;
//				this._range.setStart(this.currentToken.firstChild, 0);
//				this._range.setEnd(this.currentToken.firstChild, 0);
//				this.selectRange(this._range);
				_document.selection.empty();
				//r._select(); //mmmpf, private method
			}else if(dojo.global["getSelection"]){
				var selection = dojo.global.getSelection();
				if(selection["removeAllRanges"]){ // Mozilla
					selection.removeAllRanges();
				}
			}
        },
        compareTokenPosition: function(/*token*/ fromToken, /*token*/ toToken){
        	// returns:
        	//  0: same token and position
        	// -1: fromToken/index is before
        	//  1: fromToken/index is after
			var firstToken = fromToken.token;
			var firstIndex = fromToken.index;
			var secondToken = toToken.token;
			var secondIndex = toToken.index;
			var indexOf = this.indexOf;
			var firstParent = firstToken.parentNode;
			var secondParent = secondToken.parentNode;
			if(firstToken === secondToken && firstIndex == secondIndex){
				return 0;
			}else if( (indexOf(firstParent) < indexOf(secondParent))
				|| 
					((indexOf(firstParent) == indexOf(secondParent))
					&&
					(indexOf(firstToken) < indexOf(secondToken))) 
				||  
					((indexOf(firstParent) == indexOf(secondParent))
					&&
					(indexOf(firstToken) == indexOf(secondToken))
					&&
					(firstIndex < secondIndex)) ){
				return -1;
			}else{
				return 1;
			}
        },
        addToSelection: function(/*Object literal*/ kwPar){
			// kwPar: oldToken, oldIndex
			var oldToken = kwPar.token;
			var oldIndex = kwPar.index;
			var newToken = this.currentToken;
			var newIndex = this.caretIndex;
			if(this.getSelectedText().length == 0){
				this._range.detach();
	            this._range = dijit.range.create();
				this._range.setStart(oldToken.firstChild, oldIndex);
				this._range.setEnd(oldToken.firstChild, oldIndex);
			}

			var selectionStartToken = this.getSelectionStartToken();
			var selectionStartIndex = this.getSelectionStartIndex();
			var selectionEndToken = this.getSelectionEndToken();
			var selectionEndIndex = this.getSelectionEndIndex();

			if(this.getSelectedText().length){
				// inversion begin
				if(!this.compareTokenPosition({token:oldToken, index:oldIndex},{token:selectionStartToken,index:selectionStartIndex}) 
					&&
					(this.compareTokenPosition({token:newToken, index:newIndex},{token:selectionEndToken,index:selectionEndIndex}) == 1)){
					oldToken = this.getSelectionEndToken();
					oldIndex = this.getSelectionEndIndex();
					this._range.setStart(selectionEndToken.firstChild, selectionEndIndex);
				}
				if(!this.compareTokenPosition({token:oldToken, index:oldIndex},{token:selectionEndToken,index:selectionEndIndex}) 
					&&
					(this.compareTokenPosition({token:newToken, index:newIndex},{token:selectionStartToken,index:selectionStartIndex}) == -1)){
					oldToken = this.getSelectionEndToken();
					oldIndex = this.getSelectionEndIndex();
					this._range.setEnd(selectionStartToken.firstChild, selectionStartIndex);
				}
				// inversion end
			}
			// 4 cases
			if((this.compareTokenPosition({token:oldToken, index:oldIndex},{token:newToken,index:newIndex}) == -1)){
//				console.debug("--> ");
				if (this.compareTokenPosition({token:newToken, index:newIndex},{token:selectionEndToken,index:selectionEndIndex}) == 1){
				// 1) |__|-->I
					this._range.setEnd(newToken.firstChild, newIndex);
				}else{
				// 2) |-->__|
					this._range.setStart(newToken.firstChild, newIndex);
				}
			}else{ 
//				console.debug("<--");
				if (this.compareTokenPosition({token:newToken, index:newIndex},{token:selectionStartToken,index:selectionStartIndex}) == -1){
				// 3) I<--|__|
					this._range.setStart(newToken.firstChild, newIndex);
				}else{
				// 4) |__<--|
					this._range.setEnd(newToken.firstChild, newIndex);
				}
			
			}
			this.selectRange(this._range);
        },
        indexOf: function(node){
        	var parent = node.parentNode;
        	var children = parent.childNodes;
        	var len = children.length;
        	for(var i = 0; i < len; i++){
        		if(children[i] === node){
        			return i;
        		}
        	}
        	return -1;
        },
        moveCaretAtToken: function(/*token*/ token, /*integer*/ offset){
        	var line = token.parentNode;
        	var y = this.indexOf(line);
        	var targetOffset = offset||0;
        	this.setCaretPosition(this.getTokenX(token) + targetOffset, y);
        },
        removeSelection: function(){
			// 
			if(dojo.doc["selection"]){
				var _sel = dijit.range.getSelection(window);
				this._range = _sel.getRangeAt(0);
			}else{
				this._range = dojo.global.getSelection().getRangeAt(0); // FF only
			}
			var startToken = this._range.startContainer.parentNode;
			var endToken = this._range.endContainer.parentNode;
			var startOffset = this._range.startOffset;
			var endOffset = this._range.endOffset;
			var startLine = startToken.parentNode;
			var endLine = endToken.parentNode;
			var currentToken = startToken.nextSibling;

			this.moveCaretAtToken(startToken, startOffset);

       			this.clearSelection();

			var oldContent = startToken.firstChild.data;
			if(startToken === endToken){
				startToken.firstChild.data = oldContent.substring(0, startOffset) + oldContent.substring(endOffset);
			}else{
				// startLine begin
				startToken.firstChild.data = oldContent.substring(0, startOffset);
				var nextToken;
				if(currentToken && currentToken !== endToken){ // change in do..while
					do{
						nextToken = currentToken.nextSibling;
						this.removeFromDOM(currentToken);
						currentToken = nextToken;
					}while(nextToken && nextToken !== endToken); 
				}
				//was }while(nextToken && currentToken !== endToken);
				// startLine end

				// middle lines begin
				if(this.indexOf(startLine) < this.indexOf(endLine) - 1) {
					var currentLine = startLine.nextSibling;
					var nextLine;
					while(currentLine && (currentLine !== endLine)){
						nextLine = currentLine.nextSibling;
						this.removeFromDOM(currentLine);
						currentLine = nextLine;
					}						
				}
				// middle lines end
				
				// endLine begin
				currentToken = endToken.previousSibling;
				var previousToken;
				if(currentToken && currentToken !== startToken){ // convert in while..do
					do{
						previousToken = currentToken.previousSibling;
						this.removeFromDOM(currentToken);
						currentToken = previousToken;
					}while(previousToken && previousToken !== startToken);
				}
				// endLine end
				oldContent = endToken.firstChild.data;
				endToken.firstChild.data = oldContent.substring(endOffset);

				
			} // end else						
			/* remove the last line if endLine !== startLine */
			if((endLine !== startLine)){
				currentToken = endToken;
				while(currentToken){
					startLine.appendChild(currentToken.cloneNode(true));
					currentToken = currentToken.nextSibling;
				}
				this.removeFromDOM(endLine);
			}

			if(!startToken.firstChild.data.length){ this.removeFromDOM(startToken) };
			if(!endToken.firstChild.data.length){ this.removeFromDOM(endToken) };
			
      				this.setCurrentTokenAtCaret();
      				if(this.currentToken && this.previousToken){
            	this.mergeSimilarTokens(this.previousToken, this.currentToken);
            }
            this.colorizeToken(this.currentToken);
        },
        keyPressHandler: function(evt){
            if (this._preventLoops){
                this._preventLoops = false;
                return;
            }
            this._specialKeyPressed = true;//IE
            evt = dojo.fixEvent(evt||window.event);
            dojo.publish(this.id + "::KeyPressed", [{source:this,evt:evt}]);
            var keyCode = evt.keyCode;
            var charCode = evt.charCode;
//            console.debug("2-> charCode/keyCode: "+evt.charCode+"/"+evt.keyCode);
            var dk = dojo.keys;
            var x = this.x;
            var y = this.y;
            var lines = this.linesCollection;
            var resCode = charCode||keyCode;
            var cmd = this.commands;
            switch(resCode){
                case dk.ESCAPE:
                break;
                case dk.BACKSPACE:
                    // refactor! shared code with caret left...
         			//this.clearSelection();
         			var selection = this.getSelection();
         			var len = selection.getSelectedText().length;
         			if(!len){
         				if(!(x||y)){ return; }
	                    if(x){
	                       this.setCaretPosition(x-1, y);
	                    }else if(y){
	                       this.setCaretPosition(this.getLineLength(y-1), y-1);
	                    }
	                    this.removeCharAtCaret();
         			}else{
						this.removeSelection();
         			}
                break;
                case dk.DELETE:
                    if(charCode == dk.DELETE){ 
                        this._specialKeyPressed = false;
                        break; 
                    }
         			var selection = this.getSelection();
         			var len = selection.getSelectedText().length;
         			if(!len){
	                    this.removeCharAtCaret();
         			}else{
						this.removeSelection();
         			}
                break;
                case dk.DOWN_ARROW:
                    if(charCode==0){
                        if(!lines[y + 1]){ dojo.stopEvent(evt); return; }
                        lineLength = this.getLineLength(y+1);
						var kwPar = {
							token: this.currentToken,
							index: this.caretIndex
						}
						
                        this.setCaretPosition(x < lineLength ? x : lineLength, y+1);

                        if(evt.shiftKey){
                        	this.addToSelection(kwPar);
                        }else{
                        	this.clearSelection();
                        }
                    }else{
                        // open round bracket (
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.LEFT_ARROW:
                    if(charCode==0){
                        if(x){
							var kwPar = {
								token: this.currentToken,
								index: this.caretIndex
							}
							
                            this.setCaretPosition(x-1, y);
	                        if(evt.shiftKey){
	                        	this.addToSelection(kwPar);
	                        }else{
	                        	this.clearSelection();
	                        }
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
							var kwPar = {
								token: this.currentToken,
								index: this.caretIndex
							}

                            this.setCaretPosition(x+1, y);

                            if(evt.shiftKey){
                            	this.addToSelection(kwPar);
	                        }else{
	                        	this.clearSelection();
	                        }
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
                        if(y<1){ dojo.stopEvent(evt); return; }
                        lineLength = this.getLineLength(y-1);
						var kwPar = {
							token: this.currentToken,
							index: this.caretIndex
						}

                        this.setCaretPosition(x < lineLength ? x : lineLength, y-1);
                        if(evt.shiftKey){
                        	this.addToSelection(kwPar);
                        }else{
                        	this.clearSelection();
                        }
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
                case 97: // a
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
	                    this.execCommand(cmd.SELECTALL);
                	}
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
                case 120: // x
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        // ctrl + x
                        this._clipboard.value = this.getSelectedText();
                        this.removeSelection();
                        this._clipboard.focus();
                        this._clipboard.select();
//                        this._clipboard.value = "";
//                        this._clipboard.focus();
//                        this._command = cmd.PASTE;
                        this._specialKeyPressed = true;
                        return;
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
        getSelectionStartToken: function(){
        	return this._range.startContainer.parentNode;
        },
        getSelectionEndToken: function(){
        	return this._range.endContainer.parentNode;
        },
        getSelectionStartIndex: function(){
        	return this._range.startOffset;
        },
        getSelectionEndIndex: function(){
        	return this._range.endOffset;
        },
        getSelectionStartX: function(){
        	var x = 0;
			var startToken = this.getSelectionStartToken();
			var x = this.getSelectionStartIndex();
			var prev = startToken.previousSibling;
			while(prev){
				x += prev.firstChild.data.length;
				prev = prev.previousSibling;
			}
        	return x;
        },
        getSelectionStartY: function(){
        	var y = 0;
			var startToken = this.getSelectionStartToken();
			var startLine = startToken.parentNode;
			var y = this.indexOf(startLine);
        	return y;
        },
        getSelectionEndX: function(){
        	var x = 0;
			var endToken = this.getSelectionEndToken();
			var x = this.getSelectionEndIndex();
			var prev = endToken.previousSibling;
			while(prev){
				x += prev.firstChild.data.length;
				prev = prev.previousSibling;
			}
        	return x;
        },
        getSelectionEndY: function(){
        	var y = 0;
			var endToken = this.getSelectionEndToken();
			var endLine = endToken.parentNode;
			var y = this.indexOf(endLine);
        	return y;
        },
        isCaretAtStartOfSelection: function(/*boolean*/ def){
			if(!(this.getSelectedText() && this.getSelectedText().length)){ return !!def; }
			return ((this.x == this.getSelectionStartX()) && (this.y == this.getSelectionStartY()))
        },
        writeTab: function(){
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

            this.setCurrentTokenAtCaret();

            if(_previousTokenType == "line-terminator"){ 
                this.mergeLinesAtCaret(); 
            }
            _currentToken = this.currentToken;
            var _prevToken = _currentToken.previousSibling;
            this.mergeSimilarTokens(_prevToken, _currentToken);
            this.setCurrentTokenAtCaret();
            this.colorizeToken(this.currentToken);
        },
        removeLine: function(/*line*/ targetLine){
            this.removeFromDOM(targetLine);
            dojo.publish(this.id + "::removeLine", [{rows:1}]);
			console.debug("REMOVING A LINE");
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
                this.removeLine(_nextLine);
                
                this.setCurrentTokenAtCaret();
            }
        },
        mergeSimilarTokens: function(/*token*/ sourceToken, /*token*/ targetToken, /*boolean*/ inverted){
        	if(targetToken && sourceToken && targetToken.getAttribute("tokenType") == sourceToken.getAttribute("tokenType")){
				if(!inverted){
	            	targetToken.firstChild.data = sourceToken.firstChild.data + targetToken.firstChild.data;
				}else{
	            	targetToken.firstChild.data = targetToken.firstChild.data + sourceToken.firstChild.data;
				}
	            sourceToken.parentNode.removeChild(sourceToken);
            }
        },
        getLine: function(/*int*/ y){
            return this.linesCollection[y];
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
            
            this.setCurrentTokenAtCaret();
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
            
            dojo.publish(this.id + "::CaretMove", [{x:x + 1,y:y + 1}]);
        },
        getTokenX: function(/*token*/ token){
        	var line = token.parentNode;
        	var children = line.childNodes;
        	var len = children.length;
        	var x = 0;
        	var i = 0;
        	while(i < len && children[i] !== token){
       			x+=children[i].firstChild.data.length;
        		i++;
        	}
        	return x;
        },
        setCurrentTokenAtCaret: function(){
            // find the currentToken
            var x = this.x;
            this.currentLine = this.linesCollection[this.y];
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
            var y = Math.min(parseInt(Math.max(0, evt.layerY) / this._caretHeight), this.numLines()-1);
            var x = Math.min(parseInt(Math.max(0, evt.layerX) / this._caretWidth), this.getLineLength(y));
            this.setCaretPosition(x, y);
        },
        createLine: function(){
            var newLine = document.createElement("pre");
            newLine.className = "codeTextAreaLine";             
            newLine.style.height = this._caretHeight + "px";
            var _currentToken = this.createLineTerminator();
            newLine.appendChild(_currentToken);
 			this.lastToken = this.currentToken;
            this.currentToken = _currentToken;
            return newLine;
        },
        writeLine: function(/*String*/ text, /*Boolean*/ moveCaret){
            if(!text){ return; }
//            var tokens = text.match(/\S+|\s+/g);            
            //var tokens = text.match(/\.+|[\S+|\s+]/g);            
            var tokens = text.match(/\.+|[\S+|\s+]|\(|\)|\[|\]/g);  
            var len = tokens.length;
            for(var i = 0; i < len; i++){
                var token = tokens[i];
                this.writeToken(token);
                if(moveCaret){ this.moveCaretBy(token.length, 0); }
            }
        },
        addNewLine: function(/*string*/ position){
            var lines = this.linesCollection;
            var newLine = this.createLine();
            if(position=="end"){
                this.lines.appendChild(newLine);
            }else{
                dojo.place(newLine, lines[this.y], "after");
            }
            dojo.publish(this.id + "::addNewLine", [{rows:1}]);
            return newLine;
        },
        write: function(/*String*/ text, /*Boolean*/ moveCaret){
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
              terminatorToken.appendChild(document.createTextNode("\u000D"));
              return terminatorToken;
        },
        matchSymbol: function(/*Object literal*/ kwPar){
            var tokenType = kwPar.def;
            var _currentChar = kwPar.currentChar;
            var i = 0;
            while(i < this._symbols.length){
            	if(this._symbols[i][_currentChar]){
            		tokenType = this._symbols[i][_currentChar];
            		break;
            	}
            	i++;
            }
            return tokenType;
        },
        writeToken: function(/*String*/ content, /*Boolean*/ moveCaret, /*Boolean*/ substCaret){
            if(!content){ return; }

            // tokenType
            // find a way to add different token types!
//            var tokenType = content.charAt(0) == "." || content.charAt(0) == " " ? "separator" : "word"; 
            // parametrize this section [begin]
            var wrapper = "span";
            var _currentChar = content.charAt(0);
            var tokenType = this.matchSymbol({
                currentChar : content.charAt(0),
                def : "word"
            });
			// nr 12-15-2007b
			// substitution for " " with \u00a0, because Firefox can't select
			// a string with spaces
            if(tokenType == "separator"){
            	var len = content.length;
            	content = "";
            	for(var i = 0; i < len; i++){
            		content += "\u00a0";
            	}
            }
			// nr 12-15-2007e
            if(substCaret){
				tokenType = substCaret;
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
                            currentToken.firstChild.data.substring(0, this.caretIndex)
                            + content + currentToken.firstChild.data.substring(this.caretIndex)
                        ), 
                        currentToken.firstChild
                    );
//                    if(moveCaret){ this.moveCaretBy(content.length, 0);}
                }else{// subcase 2: different types
                    var firstText = currentToken.firstChild.data.substring(0, this.caretIndex);
                    var lastText = currentToken.firstChild.data.substring(this.caretIndex);
                    if(firstText.length!=0){
                        // first token
                        var newToken = document.createElement("span"); // SPAN?? 27-10-2007
                        newToken.appendChild(document.createTextNode(firstText));
                        newToken.setAttribute("tokenType", currentTokenType);
                        dojo.place(newToken, currentToken, "before");
                        
                        // inner token
                        var innerToken = document.createElement(wrapper);
                        innerToken.appendChild(document.createTextNode(content));
                        innerToken.setAttribute("tokenType", tokenType);
                        dojo.place(innerToken, currentToken, "before");
                        if(tokenType == "paste-delimiter"){
	                        dojo.place(innerToken.cloneNode(true), currentToken, "before");
                        }
                        console.debug("innerTokenType: " + tokenType)
    
                        // last token
                        currentToken.replaceChild(document.createTextNode(lastText),
                            currentToken.firstChild);
                        currentToken.setAttribute("tokenType", currentTokenType);
    
//    					this.lastToken = this.currentToken;
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
                    _targetToken.setAttribute("tokenType", tokenType);
                    if(_prev){
                        dojo.place(_targetToken, _prev, "after");
                        if(tokenType == "paste-delimiter"){
	                        dojo.place(_targetToken.cloneNode(true), _prev, "after");
                        }
                    }else{
                        dojo.place(_targetToken, this.currentToken, "before");
                        if(tokenType == "paste-delimiter"){
	                        dojo.place(_targetToken.cloneNode(true), this.currentToken, "before");
                        }
                    }
                }
                this.currentToken = _targetToken;
//                if(moveCaret){ this.moveCaretBy(content.length, 0); }
            }
        },
        substCaretPosition: function(){
            this.writeToken("-", false, "paste-delimiter"); // params: token, moveCaret, substCaret
//            this.writeToken("-", false, "paste-delimiter"); // params: token, moveCaret, substCaret
        },
        setBookmark: function(){
        	
        },
        _getTextDelimiter: function(/*String*/ text){
			var _index;
            _index = text.indexOf("</i>");
            if(_index == -1){
            	_index = text.indexOf("</I>"); // IE fix
            }
            return _index + 4;
        },
        removeFromDOM: function(/*DOM node*/ target){
        	if(!target.parentNode){ return };
            target.parentNode.removeChild(target);
        },
        massiveWrite: function(content){
            // find the caret position
            var _yIncrement = 0;
            var _xIncrement = 0;
            var _savedCurrentToken = this.currentToken;
            var _savedPreviousToken = this.previousToken;
            this.substCaretPosition();
            var _initialContent = this.lines.innerHTML;

            var _index = this._getTextDelimiter(_initialContent);

            var _firstFragment = _initialContent.substring(0, _index);
			
            var _lastFragment = _initialContent.substring(_index);

            var _parsedContent = "";
            var rows = content.split(/\n\r|\r\n|\r|\n/);
//            var rows = content.split(/\n/);
			
			_yIncrement = rows.length - 1;
			
            var tokens = [];            
			var cDict = this.colorsDictionary;
            for(var i = 0; i < rows.length; i++){
				//tokens = rows[i].match(/\W+|\w+/g);

				// START new solution 09-23-2007
				var row = rows[i];
				var _previousType = "";
				var _currentType = "";
				var _workingToken = "";
				var _unparsedToken = "";
				var _rowText = "";

				if(i){
					_rowText = "<pre class=\"codeTextAreaLine\" style=\"height: " + this._caretHeight + "px\">";
				}
				for(var k = 0; k < row.length; k++){
					// token classification
					var _currentChar = row.charAt(k);
					var _oldChar = _currentChar;
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
		            _currentType = this.matchSymbol({
		                currentChar : _currentChar,
		                def : "word"
		            });
					
					if(_currentChar == " "){
						_currentChar = "&nbsp;";
					}
					
					// type controls

					if(_currentType === _previousType && k < row.length - 1){
						_workingToken += _currentChar;
						_unparsedToken += _oldChar;
					}else{ // type change or end of line
						if(_currentType === _previousType){
							_workingToken += _currentChar;
							_unparsedToken += _oldChar;
						}
						if(_previousType){
							var _class = (_workingToken in cDict) ? cDict[_workingToken].className : "";
							_rowText += "<span class=\"" + _class + "\" tokenType=\"" + _previousType + "\">" + _workingToken + "</span>";
							if(i == rows.length - 1){
								_xIncrement += _unparsedToken.length;
							}
						}
						_workingToken = _currentChar;
						_unparsedToken = _oldChar;
						_previousType = _currentType;
					}
				} // end current row
				if(i<rows.length-1){
					_rowText += "<span style=\"visibility:hidden\" tokenType=\"line-terminator\">\u000D</span></pre>";
				}
				
				_parsedContent += _rowText;
				// END new solution 09-23-2007
            } // end rows cycle
            if(!dojo.isIE){
            	this.lines.innerHTML = _firstFragment + _parsedContent + _lastFragment;
            }else{
            	this.lines.innerHTML = "";
            	var container = document.createElement("div");
            	this.lines.appendChild(container);
            	container.outerHTML = _firstFragment + _parsedContent + _lastFragment;
            }

			this._addRowNumber({rows:_yIncrement});
            var _delimiters = dojo.query(".dojoCodeTextAreaLines i");
            for(var i = 0; i < _delimiters.length; i++){
            	var _currentDelimiter = _delimiters[i];
            	if(_currentDelimiter.previousSibling && _currentDelimiter.nextSibling && _currentDelimiter.nextSibling.getAttribute("tokenType") != "line-terminator"){
            		this.mergeSimilarTokens(_currentDelimiter.nextSibling, _currentDelimiter.previousSibling, true);
            	}
				this.removeFromDOM(_delimiters[i]);
            }
			this.currentToken = _savedCurrentToken;
			// error: in the following line this.x is wrong!
			var _xBase = _yIncrement ? 0 : this.x;
			this.setCaretPosition(_xBase + _xIncrement, this.y + _yIncrement);
			this.setCurrentTokenAtCaret();
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
                new dojo.data.ItemFileReadStore({data: {items:_items}});
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
                    var _xShift = 0;
					if(this.caretIndex){
						_xShift = this.caretIndex;
					}else{
	                    if(!(this._targetToken === this.currentToken)){
							_xShift = _targetToken.firstChild.data.length;
						}
					}
                    this.moveCaretBy(-(_xShift), 0);
                    _targetToken.firstChild.data = "";
                }
                this.write(this.suggestionsCombo.getValue(), true);
                this.attachEvents();
            }
        },
        loadPlugins: function(){
            var plugins = this.plugins.split(" ");
            for(var i = 0; i < plugins.length; i++){
                try{
                    if(plugins[i]){
                        dojo.require("dojox.widget._codeTextArea.plugins." + plugins[i]);
                        dojox.widget._codeTextArea.plugins[plugins[i]].startup({source:this});
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
        },
        _addRowNumber: function(/*integer*/ rowsToAdd){
        	var _previousFragment = this.leftBand.getElementsByTagName("ol")[0].innerHTML;
        	var _offset = this.leftBand.getElementsByTagName("ol")[0].getElementsByTagName("li").length + 1;
        	var _rows = "";
        	var _endCount = rowsToAdd.rows + _offset;
        	for(var i = _offset; i < _endCount; i++){
        		//_rows += "<div>"+i+"</div>";
        		_rows += "<li></li>";
        	}
        	this.leftBand.getElementsByTagName("ol")[0].innerHTML = _previousFragment + _rows;
        }
	}
);