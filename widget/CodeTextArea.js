dojo.provide("nic.widget.CodeTextArea");

dojo.require("dijit._Contained");
dojo.require("dijit._editor.selection");
dojo.require("dijit._editor.range");

dojo.require("dijit._Widget");
dojo.require("dojo.data.ItemFileReadStore");
dojo.require("dojox.xml.parser");
dojo.require("dijit._Templated");
dojo.require("dijit.form.ComboBox");

dojo.declare(
    "nic.widget.CodeTextArea",
	[dijit._Widget, dijit._Templated, dijit._Contained],
    {
		templatePath: dojo.moduleUrl("nic.widget", "CodeTextArea/CodeTextArea.html"),
        isContainer: true,

        // parameters
        height: "100%",
        width: "100%",
	    parent: null,
        // attach points
        currentLineHighLight: null,
        caret: null,
        // x: Integer
        x: 0,
        // y: Integer
        y: 0,
        plugins: "",
		resizeTo: "",
        // _caretWidth: Integer
        _caretWidth: 0,
        // lineHeight: Integer
        lineHeight: 0,
        /*boolean*/
        _specialKeyPressed: false,
        _clipboard: null,
        _range: null,
        _lineTerminator: null,
        _eventsAttached: false,
        /* parser */
        rowsToParseAtOnce: 50,
        parserInterval: 500,
        parsedRows: 0,
        parserTimeout: null,

        codeTextAreaContainer: null,
        linesCollection: null,

        currentLine: null,
        currentToken: null,
        lastToken: null,
        caretIndex: 0,
        lastCaretIndex: 0,
        colorsUrl: "",
        autocompleteUrl: "",
		selectInProgress: false,
        _command: 0,
		_blockedEvents: false,
        commands: {},
        autocompleteDictionary: {},
        colorsDictionary: {},
        _suggestionBlocked: false,
        _eventHandlers: [],
        suggestionsCombo: null,
        _targetToken: null,
        _preventLoops: false,
		_marker: null,

		// selection 08 oct
		selectionStartNode: null,
		selectionStartIndex: null,
		selectionEndNode: null,
		selectionEndIndex: null,

		// undo vars
       	_undoStack: [],
       	_undoStackIndex: -1,
        _lastEditCoords: {x:0, y:0},
		_pushNextAction: false,

        _symbols: [
        	{"."    : "context-separator"},
        	{"//"    : "single-line-comment"},
        	{"'"    : "single-quote"},
        	{"\""   : "double-quote"},
        	{" "    : "separator"},
        	{"    " : "separator"},
        	{"/*"   : "open-block-comment"},
        	{"*/"   : "closed-block-comment"},
        	{"("    : "open-round-bracket"},
        	{")"    : "closed-round-bracket"},
        	{"["    : "open-square-bracket"},
        	{"]"    : "closed-square-bracket"},
        	{"{"    : "open-curly-bracket"},
        	{"}"    : "closed-curly-bracket"}
        ],
        _symbolsList:
        	[
				{
                    merge: true,
					key: "\\&nbsp;",
					type: "separator",
					className: "",
					symbol: "&nbsp;"
				},
				{
                    merge: false,
					key: "\\&#39;",
					type: "single-quote",
					className: "quotes",
					symbol: "'"
				},
				{
                    merge: false,
					key: "\\&quot;",
					type: "double-quote",
					className: "quotes",
					symbol: "\""
				},
				{
                    merge: false,
					key: "\\.",
					type: "context-separator",
					className: "",
					symbol: "."
				},
				{
                    merge: false,
					key: "//",
					type: "single-line-comment",
					className: "startBlockComment",
					symbol: "//"
				},
//				{
//                    merge: false,
//					key: "    ",
//					type: "separator",
//					className: "",
//					symbol: "    "
//				},
				{
                    merge: false,
					key: "/\\*",
					type: "open-block-comment",
					className: "startBlockComment",
					symbol: "/*"
				},
				{
                    merge: false,
					key: "\\*/",
					type: "closed-block-comment",
					className: "endBlockComment",
					symbol: "*/"
				},
				{
                    merge: false,
					key: "\\(",
					type: "open-round-bracket",
					className: "",
					symbol: "("
				},
				{
                    merge: false,
					key: "\\)",
					type: "closed-round-bracket",
					className: "",
					symbol: ")"
				},
				{
                    merge: false,
					key: "\\[",
					type: "open-square-bracket",
					className: "",
					symbol: "["
				},
				{
                    merge: false,
					key: "\\]",
					type: "closed-square-bracket",
					className: "",
					symbol: "]"
				},
				{
                    merge: false,
					key: "\\{",
					type: "open-curly-bracket",
					className: "",
					symbol: "{"
				},
				{
                    merge: false,
					key: "\\}",
					type: "closed-curly-bracket",
					className: "",
					symbol: "}"
				}
		],
	    // nodes
	    tArea: null,
	    leftBand: null,
		uniqueTokens: {
			"open-round-bracket": true,
        	"single-line-comment": true,
			"open-square-bracket": true,
			"open-curly-bracket": true,
			"closed-round-bracket": true,
			"closed-square-bracket": true,
			"closed-curly-bracket": true,
			"single-quote": true,
			"double-quote": true,
			"context-separator": true
		},
        postCreate: function(){
			var self = this;
			dojo.style(this.tArea,{
				opacity: .01,
				position: "absolute",
				top: "0",
				left: "0",
				fontSize: "0",
				width: "0",
				height: "0"
			});
	        var parent = this.parent = this.getParent();
			if(parent && parent.isLayoutContainer){
				this.resize();
			}
			this.leftBand.id = this.id + "leftBand";
			this.lines.style.width = (dojo.coords(this.domNode).w - dojo.coords(this.leftBand).w) + "px";
            this.loadDictionary(this.autocompleteUrl, dojo.hitch(this, this._autocompleteFiller));
            this.loadDictionary(this.colorsUrl, dojo.hitch(this, this._colorsFiller));
            this.linesCollection = this.lines.getElementsByTagName("div");
            this.setDimensions();
            this.startPlugins();
            this._initializeInternals();
            // line terminator
            this._createLineTerminator();

            this._initializeDoc();
            this._initializeClipboard();
            this._initializeSuggestionsPopup();
            this._initializeRange();

			this._addRowNumber({position: 1, rows:100});
			// bottleneck with large documents
	    	dojo.subscribe(this.id + "::addNewLine", dojo.hitch(this, self._addRowNumber));
	    	dojo.subscribe(this.id + "::removeLine", dojo.hitch(this, self._removeRowNumber));

            // initial status
            this._command = "";

            this.attachEvents();
//            REMOVE THIS BLOCK
//            document.body.focus();
//            dojo.connect(dojo.body(), "onclick", this, function(e){
//				e.stopPropagation();
//				return false;
//			});
            //dojo.connect(this.domNode, "onmouseup", this, "setCaretPositionAtPointer");
            dojo.connect(this.domNode, "onmouseup", this, "mouseUpHandler");
            dojo.connect(this.domNode, "onmousedown", this, "startSelection");
//            dojo.connect(this.domNode, "onmousemove", this, "mouseMoveHandler");
//            dojo.connect(document.body, "onselectstart", this, "startSelection"); // ie
            dojo.connect(this.domNode, "onclick", this, "blur");
//            dojo.connect(this.domNode, "onblur", this, "_onNodeBlur");
//            dojo.connect(this.domNode, "onfocus", this, "_onNodeFocus");
            dojo.connect(this.domNode, "onclick", this, "onClick");
            this.setCaretPosition(0, 0);
        },
		mouseUpHandler: function(e){
			this.selectInProgress = false;
			this.setCaretPositionAtPointer(e);
			if(this.selectionStartNode || this.getSelection().getSelectedText().length){
				this.selectionEndNode = this.currentToken;
				this.selectionEndIndex = this.caretIndex;
				this._range.detach();
	            this._range = dijit.range.create();
				this._range.setStart(this.selectionStartNode.firstChild, this.selectionStartIndex);
				this._range.setEnd(this.selectionEndNode.firstChild, this.selectionEndIndex);
			}else{
				this.selectionStartNode = null;
				this.selectionStartIndex = 0;
				this.selectionEndNode = null;
				this.selectionEndIndex = 0;
			}
		},
		mouseMoveHandler: function(e){
			if(!this.selectInProgress){ return; }
			var kwPar = {
				token: this.currentToken,
				index: this.caretIndex
			};
			this.setCaretPositionAtPointer(e);
			this.addToSelection(kwPar);
		},
        startSelection: function(e){
			this.selectionStartNode = null;
			this.selectionStartIndex = 0;
			this.setCaretPositionAtPointer(e);
			this.selectInProgress = true;
			this.selectionStartNode = this.currentToken;
			this.selectionStartIndex = this.caretIndex;
        },
		resize: function(){
			var parent = this.parent;
			if(!parent){
				return;
			}
			var coords = dojo.position(parent.domNode);
			this.domNode.parentNode.style.width = coords.w + "px";
			this.domNode.style.height = coords.h + "px";
			this.height = coords.h;
			this.width = coords.w;
		},
        _initializeSuggestionsPopup: function(){
            var comboNode = document.createElement("div"),
				store,
				dn
			;
            dojo.style(comboNode, {
                position: "absolute",
                top: "0",
                left: "0",
                display: "none"
            });
            this.domNode.parentNode.appendChild(comboNode);
            store = new dojo.data.ItemFileReadStore({url: this.autocompleteUrl });

            this.suggestionsCombo = new dijit.form.ComboBox({
				name: "suggestions",
				autoComplete: false,
				store: store,
                hasDownArrow: false,
				searchAttr: "name"
			}, comboNode);
			dn = this.suggestionsCombo.domNode;
	        dojo.style(dn, {
		        position: "absolute",
		        display: "none",
		        zIndex: "100"
	        });
            dojo.connect(dn, "onkeyup", dojo.hitch(this, this.autocomplete));
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
        },
		clearDocument: function(){
			this.lines.innerHTML = "";
			this.leftBand.getElementsByTagName("ol")[0].innerHTML = "";
			this._addRowNumber({position: 1, rows:100});
			this._initializeDoc();
			this.setCaretPosition(0, 0);
		},
        blur: function(){
            // to solve IE scroll problem; find another solution
//            document.body.focus();
			this.tArea.blur();
			this._hideCaret();
        },
		onClick: function(){
			this.focus();
		},
		_onNodeBlur: function(){
			this.tArea.blur();
			this._hideCaret();
		},
		_onNodeFocus: function(){
			this.tArea.focus();
			this._showCaret();
		},
		focus: function(){
			this.tArea.focus();
			this._showCaret();
		},
        loadDictionary: function(url, callBack){
            var _self = this;
            var getArgs = {
                url: url,
                sync: true,
                handleAs: "json-comment-optional",
                error: function(err){
                	_self._dictionaryLoadError(err);
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
        	data = this._expandAutoCompleteLinks(data);
            this.autocompleteDictionary = data;
        },
        _expandAutoCompleteLinks: function(/*Object*/ data){
        	if(data.links){
        		var links = data.links || [],
					linkPath,
					targetPath,
					currentLink,
					currentTarget
				;
        		// foreach pair (link --> target)
        		for(var i = 0, ll = links.length; i < ll; i++){
        			linkPath = links[i]["link"].split(".");
        			targetPath = links[i]["target"].split(".");
        			currentLink = data;
        			currentTarget = data;
        			for(var j = 0, lp = linkPath.length; j < lp; j++){
        				currentLink = currentLink.children[linkPath[j]];
        			}
        			currentLink = currentLink ? currentLink : data;
        			for(j = 0, tp = targetPath.length; j < tp; j++){
        				currentTarget = currentTarget.children[targetPath[j]];
        			}
					var children = currentTarget.children;
        			for(var k in children){
	        			currentLink.children[k] = children[k];
        			}
        		}
        	}
       		return data;
        },
        _dictionaryLoadError: function(error){
            window.alert(error);
        },
		setWidth: function(width){
			return this.width = width;
		},
		setHeight: function(height){
			return this.height = height;
		},
		getWidth: function(){
			return this.width;//dojo.coords(this.domNode).w;
		},
		getHeight: function(){
			return this.height;//dojo.coords(this.domNode).h;
		},
        getLineLength: function(/*int*/ y){
            var line = this.linesCollection[y];
            return line ? this.getLineContent(line).length-1 : 0;
        },
		getLineContent: function(line){
			return dojox.xml.parser.textContent(line);
		},
        numLines: function(){
            return this.linesCollection.length;
        },
        clearUndoHistory: function(){
           	this._undoStack = [];
           	this._undoStackIndex = -1;
            this._lastEditCoords = {x:0, y:0};
    		this._pushNextAction = false;
        },
        execCommand: function(command){
            var cmd = this.commands;
            switch (command){
                case cmd.PASTE:
//					dojo.attr(this.tArea, "readonly", "true");
					this.detachEvents();
//                    var changes = this.massiveWrite(this._clipboard.value);
                    var changes = this.massiveWrite(this.tArea.value);
					if(changes){
						this.removeRedoHistory();
						if(this._pushNextAction ||
							!this._undoStack.length
							|| this._undoStack[this._undoStack.length - 1].action != "massiveWrite"
							|| this.x != this._lastEditCoords.x || this.y != this._lastEditCoords.y){
							this.pushIntoUndoStack({action: "massiveWrite", data: changes.data, startCoords: changes.startCoords, endCoords: {x: this.x, y: this.y}});
						}else{
							this._undoStack[this._undoStack.length - 1].data += changes.data;
						}
	                	this._lastEditCoords = { x:this.x, y:this.y };
					}
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
					this.clearSelection();
                default:
                break;
            }
            this._command = cmd.NONE;
        },
        scrollHandler: function(evt){
            this.parseViewport();
        },
        keyUpHandler: function(evt){
			if(this._blockedEvents) { return; }
            var cmd = this.commands;
            switch (this._command){
                case cmd.PASTE:
                    this.execCommand(this._command);
                break;
                default:
                break;
            }
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
            this._range = dijit.range.create();
        },
		// two methods from quirksmode.org
		getUserSelection: function(){
			return window.getSelection ? window.getSelection() : document.selection.createRange();
		},
		getRange: function(selection){
			if(selection.getRangeAt){
				window.alert("getRangeIE");
				return selection.getRangeAt(0);
			}else if(document.createRange){ // Safari!
				window.alert("others");
				var range = document.createRange();
				range.setStart(selection.anchorNode,selection.anchorOffset);
				range.setEnd(selection.focusNode,selection.focusOffset);
				return range;
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
			var _document = dojo.doc,
				selection
			;
			if(_document.selection && dojo.body().createTextRange){ // IE
				_document.selection.empty();
			}else if(dojo.global["getSelection"]){
				selection = dojo.global.getSelection();
				if(selection["removeAllRanges"]){ // Mozilla
					selection.removeAllRanges();
				}
			}
        },
		getTokenPosition: function(token, index){
			index = index || 0;
			var x = this.getTokenX(token) + index,
			    y = this.indexOf(token.parentNode)
			;
			return { x: x, y: y };
		},
        compareTokenPosition: function(/*token*/ fromToken, /*token*/ toToken){
        	// returns:
        	//  0: same token and position
        	// -1: fromToken/index is before
        	//  1: fromToken/index is after
			var firstToken = fromToken.token,
			    firstIndex = fromToken.index,
			    secondToken = toToken.token,
			    secondIndex = toToken.index,
			    indexOf = this.indexOf,
			    firstParent = firstToken.parentNode,
			    secondParent = secondToken.parentNode
			;
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
        addToSelection: function(/*Object*/ kwPar){
			// kwPar: oldToken, oldIndex
			var oldToken = kwPar.token,
			    oldIndex = kwPar.index,
			    newToken = this.currentToken,
			    newIndex = this.caretIndex
			;
			if(this.getSelectedText().length == 0){
				this._range.detach();
	            this._range = dijit.range.create();
				this._range.setStart(oldToken.firstChild, oldIndex);
				this._range.setEnd(oldToken.firstChild, oldIndex);
			}

			var selectionStartToken = this.getSelectionStartToken(),
			    selectionStartIndex = this.getSelectionStartIndex(),
			    selectionEndToken = this.getSelectionEndToken(),
			    selectionEndIndex = this.getSelectionEndIndex()
			;

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
				if (this.compareTokenPosition({token:newToken, index:newIndex},{token:selectionEndToken,index:selectionEndIndex}) == 1){
				// 1) |__|-->I
					this._range.setEnd(newToken.firstChild, newIndex);
				}else{
				// 2) |-->__|
					this._range.setStart(newToken.firstChild, newIndex);
				}
			}else{
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
        	var parent = node.parentNode,
        	    children = parent.childNodes
        	;
        	for(var i = 0, len = children.length; i < len; i++){
        		if(children[i] === node){
        			return i;
        		}
        	}
        	return -1;
        },
        moveCaretAtToken: function(/*token*/ token, /*integer*/ offset){
        	var line = token.parentNode,
        	    y = this.indexOf(line),
        	    targetOffset = offset || 0
        	;
        	this.setCaretPosition(this.getTokenX(token) + targetOffset, y);
        },
        removeSelection: function(){
//            console.log("remove selection 1");
			if(dojo.doc["selection"]){
				var _sel = dijit.range.getSelection(window);
				this._range = _sel.getRangeAt(0);
			}else{
				this._range = dojo.global.getSelection().getRangeAt(0); // FF only
			}
//			console.log("remove selection 2");
			var selectedText = this.getSelectedText(),
			    startToken = this._range.startContainer.parentNode,
			    endToken = this._range.endContainer.parentNode,
			    startOffset = this._range.startOffset,
			    endOffset = this._range.endOffset,
			    startLine = startToken.parentNode,
			    endLine = endToken.parentNode,
			    currentToken = startToken.nextSibling,
				currentLine,
				nextLine,
				nextToken
			;
			this.moveCaretAtToken(startToken, startOffset);

       		this.clearSelection();

			var oldContent = startToken.firstChild.data;
			if(startToken === endToken){
				startToken.firstChild.data = oldContent.substring(0, startOffset) + oldContent.substring(endOffset);
			}else{
				// startLine begin
				startToken.firstChild.data = oldContent.substring(0, startOffset);
				if(currentToken && currentToken !== endToken){ // change in do..while
					do{
						nextToken = currentToken.nextSibling;
						this.removeFromDOM(currentToken);
						currentToken = nextToken;
					}while(nextToken && nextToken !== endToken);
				}
				// startLine end

				// middle lines begin
				if(this.indexOf(startLine) < this.indexOf(endLine) - 1) {
					currentLine = startLine.nextSibling;
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
			return { data:selectedText };
        },
		// find a better name for this method
		removeSelectionWithUndo: function(){
//			console.log(dojo.global.getSelection());
//			window.alert(this.getUserSelection());
//			this._range = this.getRange(this.getUserSelection());

			if(!this._range.startContainer){ return }; // ie
			var startToken = this._range.startContainer.parentNode,
			    endToken = this._range.endContainer.parentNode,
			    startOffset = this._range.startOffset,
			    endOffset = this._range.endOffset,
			    selStartCoords = this.getTokenPosition(startToken, startOffset),
			    selEndCoords = this.getTokenPosition(endToken, endOffset),
			    changes = this.removeSelection(),
			    endCoords = {x: this.x, y: this.y}
			;
			this.pushIntoUndoStack({
				action: "removeSelection",
				endCoords: endCoords,
				selStartCoords: selStartCoords,
				selEndCoords: selEndCoords,
				data: changes.data
			});
		},
        keyPressHandler: function(evt){
			var changes,
				kwPar
			;
			if(this._blockedEvents) { return; }
            if (this._preventLoops){
                this._preventLoops = false;
                return;
            }
            this._specialKeyPressed = true; //IE
	        evt = dojo.fixEvent(evt || window.event);
            dojo.publish(this.id + "::KeyPressed", [{ source: this,evt: evt }]);
            var keyCode = evt.keyCode,
                charCode = evt.charCode,
                dk = dojo.keys,
                x = this.x,
                y = this.y,
                h,
                lines = this.linesCollection,
                resCode = charCode || keyCode,
                cmd = this.commands
            ;
//	        console.log("2-> charCode/keyCode: "+evt.charCode+"/"+evt.keyCode);
            switch(resCode){
            	case 0:
            		// ALT-GR
            	break;
                case dk.PAGE_UP:
	                if(charCode == 0){
						h = this.getHeight();
						this.setCaretPosition(x, Math.max(0, y - parseInt(h / this.lineHeight)));
						dojo.stopEvent(evt);
	                }else{
	                    // !
	                    this._specialKeyPressed = false;
	                }
                break;
                case dk.PAGE_DOWN:
	                if(charCode == 0){
						h = this.getHeight();
						this.setCaretPosition(x, Math.min(this.numLines() - 1, y + parseInt(h / this.lineHeight)));
						dojo.stopEvent(evt);
	                }else{
	                    this._specialKeyPressed = false;
	                }
	            break;
                case dk.ESCAPE:
                break;
                case dk.BACKSPACE:
                    // refactor! shared code with caret left...
         			//this.clearSelection();
         			if(!this.getSelection().getSelectedText().length){
         				if(!(x || y)){ return; }
						var _oldX = this.x,
						    _oldY = this.y
						;
	                    if(x){
	                       this.setCaretPosition(x-1, y);
	                    }else if(y){
	                       this.setCaretPosition(this.getLineLength(y - 1), y-1);
	                    }
	                    changes = this.removeCharAtCaret();
						if(changes){
							if(this._pushNextAction ||
							!this._undoStack.length || this._undoStack[this._undoStack.length - 1].action != "removeCharBS"
							|| _oldX != this._lastEditCoords.x || _oldY != this._lastEditCoords.y){
								this.pushIntoUndoStack({
									action: "removeCharBS",
									data: changes.data,
									coords: {x: this.x, y: this.y},
									startCoords: {x: _oldX, y: _oldY}
								});
							}else{
								// au contraire...
								this._undoStack[this._undoStack.length - 1].data = changes.data + this._undoStack[this._undoStack.length - 1].data;
								this._undoStack[this._undoStack.length - 1].coords = {x: this.x, y: this.y};
							}
						}
         			}else{
						this.removeSelectionWithUndo();
         			}
					dojo.stopEvent(evt);

	                this._lastEditCoords = { x: this.x, y: this.y };
                break;
				case dk.CAPS_LOCK:
				break;
//				case dk.F5: block f5 on IE!
//					evt.preventDefault();
//					dojo.stopEvent(evt);
//				break;
                case dk.DELETE:
                    if(charCode == dk.DELETE){
                        this._specialKeyPressed = false;
                        break;
                    }
         			if(!this.getSelection().getSelectedText().length){
	                    changes = this.removeCharAtCaret();
						if(changes){
							if(this._pushNextAction ||
							!this._undoStack.length || this._undoStack[this._undoStack.length - 1].action != "removeCharDel"
							|| this.x != this._lastEditCoords.x || this.y != this._lastEditCoords.y){
								this.pushIntoUndoStack({
									action: "removeCharDel",
									data: changes.data,
									coords: { x: this.x, y: this.y }
								});
							}else{
								// au contraire...
								this._undoStack[this._undoStack.length - 1].data += changes.data;
							}
						}
         			}else{
						this.removeSelectionWithUndo();
         			}
	                this._lastEditCoords = { x: this.x, y: this.y };
                break;
                case dk.DOWN_ARROW:
                    if(charCode == 0){
                        if(!lines[y + 1]){ dojo.stopEvent(evt); return; }
                        lineLength = this.getLineLength(y+1);
						kwPar = {
							token: this.currentToken,
							index: this.caretIndex
						};

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
                case dk.LEFT_WINDOW:
                    if(charCode == 0){
                    }else{
                        // open square bracket [
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.LEFT_ARROW:
                    if(charCode == 0){
                        if(x){
							kwPar = {
								token: this.currentToken,
								index: this.caretIndex
							};
                            this.setCaretPosition(x-1, y);
	                        if(evt.shiftKey){
	                        	this.addToSelection(kwPar);
	                        }else{
	                        	this.clearSelection();
	                        }
                        }else if(y){
                           this.setCaretPosition(this.getLineLength(y - 1), y-1);
                        }
                    }else{
                        // percent %
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.RIGHT_ARROW:
                    if(charCode == 0){
                        if(x < this.getLineLength(y)){
							kwPar = {
								token: this.currentToken,
								index: this.caretIndex
							};
                            this.setCaretPosition(x + 1, y);
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
                    if(charCode == 0){
                        if(y < 1){
                            dojo.stopEvent(evt);
                            return;
                        }
                        var lineLength = this.getLineLength(y-1);
						kwPar = {
							token: this.currentToken,
							index: this.caretIndex
						};

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
                    if(charCode == 0){
                        this.setCaretPosition(0,this.y);
                    }else{
                        // dollar $
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.END:
                    if(charCode == 0){
                        this.setCaretPosition(this.getLineLength(this.y),this.y);
                    }else{
                        // hash #
                        this._specialKeyPressed = false;
                    }
                break;
                case dk.TAB:
                    this.writeTab();
                    dojo.stopEvent(evt);
                break;
				case dk.CTRL:
                break;
				case dk.SHIFT:
                break;
				case dk.ALT:
                break;
				case dk.ENTER:
		            _oldX = this.x;
		            _oldY = this.y;
                    changes = this.splitLineAtCaret(true);
					if(this._pushNextAction || !this._undoStack.length || this._undoStack[this._undoStack.length - 1].action != "newLine"
					|| _oldX != this._lastEditCoords.x || _oldY != this._lastEditCoords.y){
						this.pushIntoUndoStack({
							action: "newLine",
							data: 1,
							coords: {x: this.x, y: this.y}, // remove coords, not used
							startCoords: { x: _oldX, y: _oldY }
						});
					}else{
						this._undoStack[this._undoStack.length - 1].data++;
						this._undoStack[this._undoStack.length - 1].coords = {x: this.x, y: this.y}; // not used, remove
					}
		            this._lastEditCoords = { x: this.x, y: this.y };
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
//                        this._clipboard.value = "";
//                        this.tArea.value = "";
//						dojo.attr(this.tArea, "readonly", "false");
//                        this._clipboard.focus();
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
//                        this._clipboard.value = this.getSelectedText();
                        this.tArea.value = this.getSelectedText();
                        this.removeSelection();
//                        this._clipboard.focus();
//                        this._clipboard.select();
                        this.tArea.select();
                        this._specialKeyPressed = true;
                        return;
                    }
                break;
                case 122: // z
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        // ctrl + z
                        this._specialKeyPressed = true;
                        var _undoStack = this._undoStack;
						this.undo();
                        return;
                    }
                break;
                case 121: // y
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }else{
                        // ctrl + y
                        this._specialKeyPressed = true;
                        evt.preventDefault();
						this.redo();
                        return;
                    }
                break;
                case 32: // space
                    if(!evt.ctrlKey && !evt.shiftKey){
                        this._specialKeyPressed = false;
                    }else{
                        this._suggestionBlocked = true;
                        this.detachEvents();
                        this.showSuggestions();
                    }
                break;
                default:
                    if(!evt.ctrlKey){
                        this._specialKeyPressed = false;
                    }
                break;

            }
            /* TODO: use massiveWrite instead */
            if(!this._specialKeyPressed){
//                this.write(String.fromCharCode(resCode), true);
                this.kWrite(String.fromCharCode(resCode), true);
                //this.massiveWrite(String.fromCharCode(resCode), true);
            }
            dojo.stopEvent(evt); // prevent default action (opera) // to TEST!
//            evt.preventDefault(); // prevent default action (opera)
        },
        removeRedoHistory: function(){
            this._undoStack.length = this._undoStackIndex + 1;
        },
        pushIntoUndoStack: function(/*object*/ undoObject){
//	        console.log("push into undo stack")
			this._pushNextAction = false;
           	this.removeRedoHistory();
           	this._undoStack.push(undoObject);
          	this._undoStackIndex++;
        },
        undo: function(){
			this.clearSelection();
			var undoStack = this._undoStack;
//	        console.log(this._undoStackIndex)
	        if(!undoStack.length || this._undoStackIndex < 0){
				// nothing to (un)do
				return;
			}
			this._pushNextAction = true;
			var undoObject = undoStack[this._undoStackIndex], // pop! (1)
				action = undoObject.action,
				coords = undoObject.coords
			;
			if(undoObject.action == "writeToken"){
				var charsToRemove = undoObject.data.length;
				this.setCaretPosition(coords.x, coords.y);
				for(var i = 0; i < charsToRemove; i++){
					this.removeCharAtCaret();
				}
			}else if(action == "removeCharBS"){
				//var startCoords = undoObject.startCoords;
				this.setCaretPosition(coords.x, coords.y);
				this.write(undoObject.data, true, true);
			}else if(action == "removeCharDel"){
				this.setCaretPosition(coords.x, coords.y);
				this.write(undoObject.data, true, true);
				this.setCaretPosition(coords.x, coords.y);
			}else if(action == "newLine"){
				var startCoords = undoObject.startCoords;
				this.setCaretPosition(startCoords.x, startCoords.y);
				var charsToRemove = undoObject.data;
				for(var i = 0; i < charsToRemove; i++){
					this.removeCharAtCaret(undoObject.data);
				}
			}else if(action == "massiveWrite"){
				var startCoords = undoObject.startCoords,
				    endCoords = undoObject.endCoords
				;
				this.setCaretPosition(startCoords.x, startCoords.y);
				var startToken = this.currentToken,
				    index = this.caretIndex
				;
				this.setCaretPosition(endCoords.x, endCoords.y);
				this.addToSelection({token: startToken, index: index});
				this.removeSelection();
			}else if(action == "removeSelection"){
				var selStartCoords = undoObject.selStartCoords,
				    selEndCoords = undoObject.selEndCoords,
				    endCoords = undoObject.endCoords
				;
				this.setCaretPosition(endCoords.x, endCoords.y);
				this.massiveWrite(undoObject.data);
				this.setCaretPosition(selStartCoords.x, selStartCoords.y);
				var startToken = this.currentToken,
				    index = this.caretIndex
				;
				this.setCaretPosition(selEndCoords.x, selEndCoords.y);
				this.addToSelection({token: startToken, index: index});
				this.setCaretPosition(endCoords.x, endCoords.y);
			}
			if(undoStack.length){
				this._undoStackIndex--; // pop! (2)
			}
			// 04/apr/2009
	        this._lastEditCoords = { x: this.x, y: this.y };
        },
        redo: function(){
			this.clearSelection();
			var undoStack = this._undoStack;
        	if(!undoStack.length || /*this._undoStackIndex < 0 ||*/ this._undoStackIndex == undoStack.length - 1){
				//nothing to (re)do
				return;
			}
			this._undoStackIndex++;
			var undoObject = undoStack[this._undoStackIndex],
			    coords = undoObject.coords,
			    action = undoObject.action
			;
			if(action == "writeToken"){
				this.setCaretPosition(coords.x, coords.y);
				this.massiveWrite(undoObject.data);
				//this.moveCaretBy(undoObject.data.length, 0);
			}else if(action == "removeCharBS"){
				var charsToRemove = undoObject.data.length;
				this.setCaretPosition(coords.x, coords.y);
				for(var i = 0; i < charsToRemove; i++){
					this.removeCharAtCaret();
				}
			}else if(action == "removeCharDel"){
				var charsToRemove = undoObject.data.length;
				this.setCaretPosition(coords.x, coords.y);
				for(var i = 0; i < charsToRemove; i++){
					this.removeCharAtCaret();
				}
			}else if(action == "newLine"){
				var linesToAdd = undoObject.data,
				    startCoords = undoObject.startCoords
				;
				this.setCaretPosition(startCoords.x, startCoords.y);
				for(var i = 0; i < linesToAdd; i++){
					this.splitLineAtCaret(true);
				}
			}else if(action == "massiveWrite"){
				var startCoords = undoObject.startCoords;
				this.setCaretPosition(startCoords.x, startCoords.y);
				this.massiveWrite(undoObject.data);
			}else if(action == "removeSelection"){
				var selStartCoords = undoObject.selStartCoords,
				    selEndCoords = undoObject.selEndCoords,
				    endCoords = undoObject.endCoords
				;
				this.setCaretPosition(selStartCoords.x, selStartCoords.y);
				var startToken = this.currentToken,
				    index = this.caretIndex
				;
				this.setCaretPosition(selEndCoords.x, selEndCoords.y);
				this.addToSelection({token: startToken, index: index});
				this.removeSelection();
				this.setCaretPosition(endCoords.x, endCoords.y);
			}
        },
		getContent: function(/* node */ target){
            target = target || this.lines;
			return target.innerText || target.textContent || '';
		},
		getStructuredContent: function(/* node */ target){
            target = target || this.lines;
			return target.innerHTML;
		},
		setContent: function(/** String */ content){
			this.lines.innerHTML = content;
			var rowsNumCount = this._getRowNumbersCount(),
				rowsCount = this.linesCollection.length
			;
			if(rowsNumCount < rowsCount){
				this._addRowNumber({position: 1, rows: rowsCount - rowsNumCount });
			}
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
        	var x = 0,
			    startToken = this.getSelectionStartToken(),
			    x = this.getSelectionStartIndex(),
			    prev = startToken.previousSibling
			;
			while(prev){
				x += prev.firstChild.data.length;
				prev = prev.previousSibling;
			}
        	return x;
        },
        getSelectionStartY: function(){
        	var y = 0,
			    startToken = this.getSelectionStartToken(),
			    startLine = startToken.parentNode,
			    y = this.indexOf(startLine)
			;
        	return y;
        },
        getSelectionEndX: function(){
        	var x = 0,
			    endToken = this.getSelectionEndToken(),
			    x = this.getSelectionEndIndex(),
			    prev = endToken.previousSibling
			;
			while(prev){
				x += prev.firstChild.data.length;
				prev = prev.previousSibling;
			}
        	return x;
        },
        getSelectionEndY: function(){
        	var y = 0,
			    endToken = this.getSelectionEndToken(),
			    endLine = endToken.parentNode,
			    y = this.indexOf(endLine)
			;
        	return y;
        },
        isCaretAtStartOfSelection: function(/*boolean*/ def){
			if(!(this.getSelectedText() && this.getSelectedText().length)){ return !!def; }
			return ((this.x == this.getSelectionStartX()) && (this.y == this.getSelectionStartY()))
        },
        writeTab: function(){
            this.write("    ", true);
        },
		_hideCaret: function(){
			dojo.style(
				this.caret,
				{
					display: "none"
				}
			);
		},
		_showCaret: function(){
			dojo.style(
				this.caret,
				{
					display: "block"
				}
			);
		},
        removeCharAtCaret: function(){
			var removedChar,
                _currentToken = this.currentToken,
                _previousTokenType = _currentToken.getAttribute("tokenType")
            ;
            if(this.y == this.numLines() - 1 && _previousTokenType == "line-terminator"){
                return;
            }
            var _content = _currentToken.firstChild.data,
                _tokenSize = _content.length
            ;
            if(_tokenSize > 1){
				removedChar = _content.substring(this.caretIndex, this.caretIndex + 1)
                _currentToken.firstChild.data = _content.substring(0, this.caretIndex) +
                    _content.substring(this.caretIndex + 1);
                this.colorizeToken(_currentToken);
            }else{
                _currentToken.parentNode.removeChild(_currentToken);
				removedChar = _currentToken.firstChild.data;
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
			dojo.publish(this.id + "::removeCharAtCaret");
			return {data: removedChar};
        },
        removeLine: function(/*line*/ targetLine, /*integer*/ y){
            this.removeFromDOM(targetLine);
            dojo.publish(this.id + "::removeLine", [{rows:1, position:y, signum:-1}]);
        },
        mergeLinesAtCaret: function(){
            var _currentLine = this.currentLine,
                y = this.y
            ;
            if(y < this.numLines() - 1){
                var _nextLine = this.getLine(y + 1),
                    _nextElement = _nextLine.firstChild
                ;
                while(_nextElement){
                    _currentLine.appendChild(_nextElement);
                    _nextElement = _nextLine.firstChild;
                }
                this.removeLine(_nextLine, y);
                this.setCurrentTokenAtCaret();
            }
        },
        mergeSimilarTokens: function(/*token*/ sourceToken, /*token*/ targetToken, /*boolean*/ inverted){
        	if(targetToken && sourceToken && targetToken.getAttribute("tokenType") == sourceToken.getAttribute("tokenType") && !this.uniqueTokens[targetToken.getAttribute("tokenType")]){
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
        splitLineAtCaret: function(/*boolean*/ moveCaret){
            var _previousToken = this.currentToken.previousSibling,
                _token =  this.currentToken,
                _tokensToMove = []
            ;
            while(_token){
                if(_token.getAttribute("tokenType") == "line-terminator"){ break; }
                _tokensToMove.push(_token);
                _token = _token.nextSibling;
            }
            if(this.caretIndex && _tokensToMove[0]){
                var caretIndex = this.caretIndex,
                    _initialContent = _tokensToMove[0].firstChild.data,
                    _tokenType = _tokensToMove[0].getAttribute("tokenType")
                ;
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
			if(moveCaret){
				this.setCaretPosition(0, this.y + 1);
			}
        },
        // TODO: find a better name for these methods
        moveCaretBy: function(/*int*/ x, /*int*/ y){
            this.setCaretPosition(this.x + x, this.y + y);
        },
        setCaretPosition: function(/*int*/ x, /*int*/ y){
            this.caret.style.left = x*this._caretWidth + "px";
            this.x = x;
            var _xPx = x * this._caretWidth,
                _yPx = y * this.lineHeight,
                lineChanged = this.y !== y
            ;
            this.currentLineHighLight.style.top = _yPx + "px";
            this.y = y;
            this.setCurrentTokenAtCaret({
                lineChanged: lineChanged
            });

            // scroll

			var w = this.getWidth(),
				h = this.getHeight(),
				_yLim =_yPx + 2*this.lineHeight
			;
            if(_yLim >= h + this.domNode.scrollTop){
                this.domNode.scrollTop = _yLim - h;
            }else if(_yPx < this.domNode.scrollTop){
                this.domNode.scrollTop = _yPx;
            }
            this.currentLineHighLight.style.width = Math.max(w, this._caretWidth*(this.x+1)) + "px";
            var _xLim =_xPx + 3*this._caretWidth; // a computed value is better than 3...
            if(_xLim >= w/* + this.domNode.scrollLeft*/){
                this.domNode.scrollLeft = _xLim - w;
            }else if(_xPx < this.domNode.scrollLeft){
                this.domNode.scrollLeft = _xPx;
            }
            dojo.publish(this.id + "::CaretMove", [{x:x + 1,y:y + 1}]);
        },
        getTokenX: function(/*token*/ token){
        	var line = token.parentNode,
        	    children = line.childNodes,
        	    len = children.length,
        	    x = 0,
        	    i = 0
        	;
        	while(i < len && children[i] !== token){
       			x+= children[i].firstChild && children[i].firstChild.data ? children[i].firstChild.data.length : 0;
        		i++;
        	}
        	return x;
        },
        setCurrentTokenAtCaret: function(args){
            // find the currentToken

            // workaround for a IE performance issue
            if(args && args.lineChanged){
                this.currentLine = this.linesCollection[this.y];
            }
            var tokens = this.currentLine.getElementsByTagName("span");
            var x = this.x,
                lastChar = 0,
                firstChar = 0,
                tokensLength = tokens.length
            ;
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
	    onFocus: function(){
			this.attachEvents();
		    this.inherited(arguments);
		    this._showCaret();
			// re-read the current line
		    this.currentLine = this.linesCollection[this.y];
	    },
	    onBlur: function(){
			this.detachEvents();
		    this.inherited(arguments);
		    this._hideCaret();
	    },
        setDimensions: function(){
			var coords = dojo.coords(this.domNode);
            this._caretWidth = dojo.style(this.caret, "width");
            this.lineHeight = dojo.contentBox(this.currentLineHighLight).h;
            this.width = coords.w;
            this.height = coords.h;
        },
        attachEvents: function(){
	        if(this._eventsAttached){
		        return;
	        }
            var node = this.tArea; //document;
            this._eventHandlers.push(dojo.connect(node, "onkeypress", this, "keyPressHandler"));
            this._eventHandlers.push(dojo.connect(node, "onkeyup", this, "keyUpHandler"));
            this._eventHandlers.push(dojo.connect(this.domNode, "onscroll", this, "scrollHandler"));
//            this._eventHandlers.push(dojo.connect(document, "onfocus", this, "docFocusHandler"));
	        this._eventsAttached = true;
        },
        detachEvents: function(){
	        if(!this._eventsAttached){
		        return;
	        }
            for(var i = 0; i < this._eventHandlers.length; i++){
                dojo.disconnect(this._eventHandlers[i]);
            }
            this._eventHandlers.length = 0;
	        this._eventsAttached = false;
        },
	    docFocusHandler: function(evt){
	    },
        setCaretPositionAtPointer: function(e){
            var evt = dojo.fixEvent(e),
			    coords = dojo.coords(this.domNode),
                y = Math.min(parseInt(Math.max(0, evt.clientY - coords.y + this.domNode.scrollTop) / this.lineHeight), this.numLines()-1),
                x = Math.min(parseInt(Math.max(0, evt.layerX + this.domNode.scrollLeft) / this._caretWidth), this.getLineLength(y))
            ;
            this.setCaretPosition(x, y);
        },
        createLine: function(){
            var newLine = document.createElement("div");
            newLine.className = "codeTextAreaLine";
            newLine.style.height = this.lineHeight + "px";
            var _currentToken = this.getLineTerminator();
            newLine.appendChild(_currentToken);
 			this.lastToken = this.currentToken;
            this.currentToken = _currentToken;
            return newLine;
        },
        writeLine: function(/*String*/ text, /*Boolean*/ moveCaret, /*Boolean*/ noUndo){
            if(!text){ return; }
//            var tokens = text.match(/\S+|\s+/g);
            //var tokens = text.match(/\.+|[\S+|\s+]/g);
            var tokens = text.match(/\.+|[\S+|\s+]|\(|\)|\[|\]/g);
            var len = tokens.length;
            for(var i = 0; i < len; i++){
                var token = tokens[i],
                    changes = this.writeToken(token);
                ;
				if(!noUndo){
					if(token){ this.removeRedoHistory(); }
					if(this._pushNextAction ||
						!this._undoStack.length
						|| changes.typeChange
						|| this._undoStack[this._undoStack.length - 1].action != "writeToken"
						|| this.x != this._lastEditCoords.x || this.y != this._lastEditCoords.y){
						this.pushIntoUndoStack({action: "writeToken", data: changes.data, coords: {x: this.x, y: this.y}});
					}else{
						this._undoStack[this._undoStack.length - 1].data += changes.data;
					}
				}
                if(moveCaret){ this.moveCaretBy(token.length, 0); }
			    this._lastEditCoords = {x:this.x, y:this.y};
            }
        },
        addNewLine: function(/*string*/ position){
            var lines = this.linesCollection,
                newLine = this.createLine(),
			    insertionPoint = 0
			;
            if(position == "end"){
                this.lines.appendChild(newLine);
				insertionPoint = this.lines.length + 1;
            }else{
                dojo.place(newLine, lines[this.y], "after");
				insertionPoint = this.y + 1;
            }
            dojo.publish(this.id + "::addNewLine", [{rows:1, position:insertionPoint, signum:1}]);
            return newLine;
        },
        write: function(/*String*/ text, /*Boolean*/ moveCaret, /*Boolean*/ noUndo){
            if(!text){ return; }
            var rows = text.split(/\n\r|\r\n|\r|\n/);
            for(var i = 0; i < rows.length; i++){
                var line;
                if(i){
                    this.splitLineAtCaret(moveCaret);
                }else{
                    line = this.currentLine;
                }
                if(moveCaret){ this.currentLine = line; }
                this.writeLine(rows[i], moveCaret, noUndo);
            }
            //if(moveCaret){ this.setCaretPosition(this.x, this.y); }
        },
        _createLineTerminator: function(){
            this._lineTerminator = document.createElement("span");
            this._lineTerminator.style.visibility = "hidden";
            this._lineTerminator.setAttribute("tokenType", "line-terminator");
            this._lineTerminator.appendChild(document.createTextNode("\u000D"));
        },
        getLineTerminator: function(){
            return this._lineTerminator.cloneNode(true);
        },
		_matchSymbols: function(/** Text */ content){
			var s = this._symbolsList,
                re
            ;
			dojo.forEach(s, function(item){
                re = new RegExp(item["key"], "g");
                if(item["merge"]){
                    if(content.match(new RegExp("((" + item["symbol"] + ")+)"))){
                        var ts = (new Date()).getTime();
                    }
                    content = content.replace(re, item["symbol"]);
                    content = content.replace(new RegExp("((" + item["symbol"] + ")+)", "g"), "<span tokenType='"
                        + item["type"]+ "' class='" + item["className"] + "'>$1</span>");
                }else{
                    content = content.replace(re, "<span tokenType='"
                        + item["type"]+ "' class='" + item["className"] + "'>" + item["symbol"] + "</span>");
                }
			});
			return content;
		},
        matchSymbol: function(/*Object*/ kwPar){
            var tokenType = kwPar.def,
                _currentChar = kwPar.currentChar,
                i = 0
            ;
            while(i < this._symbols.length){
            	if(this._symbols[i][_currentChar]){
            		tokenType = this._symbols[i][_currentChar];
            		break;
            	}
            	i++;
            }
            return tokenType;
        },
		getViewPort: function(){
			var lineHeight = this.lineHeight,
			    scrollTop = this.domNode.scrollTop,
			    startLine = parseInt(scrollTop / lineHeight),
			    h = this.getHeight(),
			    endLine = Math.min(parseInt((scrollTop + h) / lineHeight), this.linesCollection.length - 1)
			;
			return { startLine: startLine, endLine: endLine };
		},
        writeToken: function(/*String*/ content, /*Boolean*/ moveCaret, /*Boolean*/ substCaret){
            if(!this.currentToken.parentNode){
                // currentToken destroyed by the asynch parse
                this.setCurrentTokenAtCaret();
            }
			if(this.getSelection().getSelectedText().length){
	            if(substCaret){
	                this.getSelection().collapse();
	            }
				this.removeSelectionWithUndo();
			}
			var originalContent = content;
            if(!content){ return; }
			var typeChange = false,
            // parametrize this section [begin]
                wrapper = "span",
                _currentChar = content.charAt(0),
                tokenType = this.matchSymbol({
                    currentChar : content.charAt(0),
                    def : "word"
            });
			// substitution for " " with \u00a0, because Firefox can't select
			// a string containing spaces
            if(tokenType == "separator"){
            	var len = content.length;
            	content = "";
            	for(var i = 0; i < len; i++){
            		content += "\u00a0";
            	}
            }
            if(substCaret){
				tokenType = substCaret;
				wrapper = "i";
            }
            // parametrize this section [end]

            var currentToken = this.currentToken,
                _previousCurrentToken = currentToken,
                currentTokenType = currentToken.getAttribute("tokenType")
            ;
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
                }else{// subcase 2: different types
					typeChange = true;
                    var _data = currentToken.firstChild.data,
                        firstText = _data.substring(0, this.caretIndex),
                        lastText = _data.substring(this.caretIndex)
                    ;
                    if(firstText.length != 0){
                        // first token
                        var newToken = document.createElement("span");
                        newToken.appendChild(document.createTextNode(firstText));
                        newToken.setAttribute("tokenType", currentTokenType);
                        dojo.place(newToken, currentToken, "before");

                        // inner token
                        var innerToken = document.createElement(wrapper);
						if(wrapper == "i"){
							this._marker = innerToken;
						}
                        innerToken.appendChild(document.createTextNode(content));
                        innerToken.setAttribute("tokenType", tokenType);
                        dojo.place(innerToken, currentToken, "before");

                        if(tokenType == "paste-delimiter"){
	                        //dojo.place(innerToken.cloneNode(true), currentToken, "before");
                        }

                        // last token
                        currentToken.replaceChild(document.createTextNode(lastText),
                            currentToken.firstChild);
                        currentToken.setAttribute("tokenType", currentTokenType);

                        this.currentToken = currentToken = innerToken;
                    }
                }
            }else{
                // *************************************************************
                // 2) between two tokens
                // *************************************************************
                var _prev = this.currentToken.previousSibling,
                    _targetToken
                ;
                if(_prev && _prev.getAttribute("tokenType") == tokenType && !this.uniqueTokens[tokenType]){
                    _targetToken = _prev;
                    _targetToken.replaceChild(document.createTextNode(_targetToken.firstChild.data + content), _targetToken.firstChild);
                }else if(tokenType == currentTokenType && !this.uniqueTokens[tokenType]/* || currentTokenType == ""*/){
                    // if currentTokenType == "" => first (unique) token in this line
                    _targetToken = this.currentToken;
                    _targetToken.replaceChild(document.createTextNode(content + _targetToken.firstChild.data), _targetToken.firstChild);
                }else{
					typeChange = true;
                    // create a new token
                    _targetToken = document.createElement(wrapper);
					if(wrapper == "i"){
						this._marker = _targetToken;
					}
                    _targetToken.appendChild(document.createTextNode(content));
                    _targetToken.setAttribute("tokenType", tokenType);
                    if(_prev){
                        dojo.place(_targetToken, _prev, "after");
                        if(tokenType == "paste-delimiter"){
	                        //dojo.place(_targetToken.cloneNode(true), _prev, "after");
                        }
                    }else{
                        dojo.place(_targetToken, this.currentToken, "before");
                        if(tokenType == "paste-delimiter"){
	                        //dojo.place(_targetToken.cloneNode(true), this.currentToken, "before");
                        }
                    }
                }
                this.currentToken = _targetToken;
            }
			dojo.publish(this.id + "::writeToken", [{tokenType:tokenType}]);
			return {data: originalContent, typeChange: typeChange};
        },
        substCaretPosition: function(){
            this.writeToken("-", false, "paste-delimiter"); // params: token, moveCaret, substCaret
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
        	if(!target || !target.parentNode){ return };
            target.parentNode.removeChild(target);
        },
	    parseText: function(text){
		    var
			    // nText: normalized text
			    nText = this.normalizeText(text),
			    // pText: partially tokenized
			    pText = this._matchSymbols(nText),
			    // tText: tokenized text
			    tText = this.tokenizeWords(pText)
		    ;
		    return tText;
	    },
		parseLine: function(args){
			var lineIndex = args.lineIndex,
			    line = this.linesCollection[lineIndex],
			    lineContent = this.getLineContent(line).replace(/\u000D/g, "").replace(/\u000A/g, ""),
                tokens = [],
			    cDict = this.colorsDictionary,
				_currentType = "",
				_workingToken = "",
				_unparsedToken = "",
				_rowText = "",
				parsedLine = "",
			    _previousType = ""
			;
			if(dojo.attr(line, "parsed") && !args.force){
				return;
			}else{
				dojo.attr(line, "parsed", "true");
			}
//			for(var k = 0; k < lineContent.length; k++){
//				// token classification
//				var _currentChar = lineContent.charAt(k),
//				    _oldChar = _currentChar
//				;
//				// html START
//				if(_currentChar == "&"){
//					_currentChar = "&amp;";
//				}else if(_currentChar == "\t"){
//					_currentChar = "    ";
//				}else if(_currentChar == "\u00A0"){
//					_currentChar = " ";
//				}else if(_currentChar == "<"){
//					_currentChar = "&lt;";
//				}else if(_currentChar == ">"){
//					_currentChar = "&gt;";
//				}else if(_currentChar == ";"){
//					//window.alert("fullstop");
//				}
//				// html END
//
//
//				// use _matchSymbols instead
//
//	            _currentType = this.matchSymbol({
//	                currentChar : _currentChar,
//	                def : "word"
//	            });
//
//
//				if(_currentChar == " "){
//					_currentChar = "&nbsp;";
//				}else if(_currentChar == "    "){ // find a better way to do this
//					_currentChar = "&nbsp;&nbsp;&nbsp;&nbsp;";
//				}
//
//				// type controls
//
//				if(_currentType === _previousType && k < lineContent.length - 1 && !this.uniqueTokens[_currentType]){
//					_workingToken += _currentChar;
//					_unparsedToken += _oldChar;
//				}else{ // type change or end of line
//					if(_currentType === _previousType && !this.uniqueTokens[_currentType]){
//						_workingToken += _currentChar;
//						_unparsedToken += _oldChar;
//					}
//					if(_previousType){
//						var _class = (_workingToken in cDict) ? cDict[_workingToken].className : "";
//						parsedLine += "<span class=\"" + _class + "\" tokenType=\"" + _previousType + "\">" + _workingToken + "</span>";
//					}
//					if(k == lineContent.length - 1 && (_currentType !== _previousType || (_currentType === _previousType && this.uniqueTokens[_currentType])) ){
//						var _class = (_currentChar in cDict) ? cDict[_currentChar].className : "";
//						parsedLine += "<span class=\"" + _class + "\" tokenType=\"" + _currentType + "\">" + _currentChar + "</span>";
//					}
//					_workingToken = _currentChar;
//					_unparsedToken = _oldChar;
//					_previousType = _currentType;
//				}
//			}
//			var
//				// nText: normalized text
//				nText = this.normalizeText(lineContent),
//				// pText: partially tokenized
//				pText = this._matchSymbols(nText),
//				// tText: tokenized text
//				tText = this.tokenizeWords(pText)
//			;
			var tText = this.parseText(lineContent);
			line.innerHTML = tText;
			var words = dojo.query("[tokenType$=word]", line),
				word = ""
			;
			dojo.forEach(words, function(item){
				word = item.innerHTML;
				dojo.attr(item, "class", (word in cDict) ? cDict[word].className : "");
			});
			line.appendChild(this.getLineTerminator());
		},
		tokenizeWords: function(/** String */text){
			if(text == ""){
				return "";
			}else{
				if(text.lastIndexOf("/span>") != (text.length - 6)){
					text += "</span>"
				}
				if(text.indexOf("<span") != 0){
					text = "<span tokenType='word'>" + text;
				}
				return text.replace(/(?!^)(?!>)<span/g, "</span><span")
					.replace(/\/span>(?!<)(?!$)/g, "/span><span tokenType='word'>")
				;
			}
		},
		normalizeText: function(/** String */text){
			return text.replace(/\&/g, "&amp;")
//				.replace(/\t/g, "    ")
				.replace(/\u00A0/g, " ")
				.replace(/\s/g, "&nbsp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/\'/g, "&#39;")
			;
		},
		parseDocument: function(args){
			this.parseFragment({ startLine: 0, endLine: this.linesCollection.length - 1, asynch: args.asynch || false });
		},
		parseFragment: function(args){
			var startLine = args.startLine,
				endLine = args.endLine,
				asynch = args.asynch || false
			;
			if(asynch){
			    var self = this,
			        linesCollection = this.linesCollection,
					rowsToParse = endLine - startLine
			    ;
    			dojo.publish(this.id + "::startParse", [{ rowsToParse: rowsToParse }]);
				self.parsedRows = 0;
			    this.parserTimeout = setTimeout(function(){
			        var parsedRows = self.parsedRows,
			            limit = Math.min(self.rowsToParseAtOnce, rowsToParse - parsedRows)
			        ;
			        for(var i = 0; i < limit; i++){
			            self.parseLine({ lineIndex: parsedRows++ });
			        }
        			dojo.publish(self.id + "::parseBlock", [{ parsedRows: parsedRows }]);
			        if(parsedRows < rowsToParse){
			            self.parserTimeout = setTimeout(arguments.callee, self.parserInterval);
			        }else{
            			dojo.publish(self.id + "::fragmentParsed");
			        }
			        self.parsedRows = parsedRows;
			    }, this.parserInterval);
			}else{
    			for(var i = startLine; i <= endLine; i++){
    				this.parseLine({lineIndex: i});
    			}
			}
		},
		parseViewport: function(args){
			var lines = this.getViewPort(),
			    endLine = lines.endLine
			;
			this.parseFragment({ startLine: lines.startLine, endLine: lines.endLine });
			dojo.publish(this.id + "::viewportParsed");

		},
        kWrite: function(content){
            var currentLine = this.currentLine,
                tokens = currentLine.childNodes.length,
                x = this.x,
                y = this.y,
                lec = this._lastEditCoords,
                fromLastCoords = (lec.x == this.x && lec.y == this.y),
                changes = this.massiveWrite(content),
                actualTokens = currentLine.childNodes.length
            ;
            if(!this._undoStack.length
                || (fromLastCoords && actualTokens != tokens)
                || (this._undoStack[this._undoStack.length - 1].action != "writeToken") ){
                this.pushIntoUndoStack({action: "writeToken", data: changes.data, coords: {x: x, y: y}});
	            var token = this.previousToken,
	                tokenType = token ? dojo.attr(this.previousToken, "tokenType") : null
		        ;
	            dojo.publish(this.id + "::newToken", [{ token: token, tokenType: tokenType }]);
            }else{
                this._undoStack[this._undoStack.length - 1].data += changes.data;
            }
            this._lastEditCoords = { x: this.x, y: this.y };
        },
		massiveWrite: function(content){
            // find the caret position
			var time0 = (new Date()).getTime();
            var _yIncrement = 0,
                _savedCurrentToken = this.currentToken,
		        _savedPreviousToken = this.previousToken
		    ;
			var time1 = (new Date()).getTime();
            this.substCaretPosition();
			var time2 = (new Date()).getTime();
//			console.log("elapsed time2: " + (time2-time1));
			var startCoords = { x: this.x, y: this.y },
			// IE doesn't handle correctly split used with a regexp.
                content = content.replace(/\n\r|\r\n|\r|\n/g, "\n"),
//                rows = content.split(/\n\r|\r\n|\r|\n/),
                rows = content.split("\n"),
                rowsNum = rows.length
            ;

            if(rowsNum == 1){
                this.removeFromDOM(this._marker);
            }
            var _initialContent = rowsNum > 1 ? this.lines.innerHTML : this.getContent(this.currentLine),
                _index = rowsNum > 1 ? this._getTextDelimiter(_initialContent) : this.x,
                target = rowsNum > 1 ? this.lines : this.currentLine,
                _firstFragment = rowsNum > 1 ? _initialContent.substring(0, _index) : this.parseText(_initialContent.substring(0, _index)),
                _lastFragment = _initialContent.substring(_index),
                _parsedContent = "",
                timeSplit0, timeSplit1,
                tokens = [],
                cDict = this.colorsDictionary,
                rowLen
            ;
			_yIncrement = rowsNum - 1;
            timeSplit0 = (new Date()).getTime();
            for(var i = 0; i < rowsNum; i++){
				// START new solution 09-23-2007
				var row = rows[i],
				    _rowText = ""
				;
				if(i){
					_rowText = "<div class=\"codeTextAreaLine\" style=\"height: " + this.lineHeight + "px\">";
				}
				rowLen = row.length;
				for(var k = 0; k < rowLen; k++){
					// token classification
					var _currentChar = row.charAt(k),
						_oldChar = _currentChar
					;
					// html START
					if(_currentChar == "&"){
						_currentChar = "&amp;";
					}else if(_currentChar == "\t"){
						_currentChar = "    ";
					}else if(_currentChar == "<"){
						_currentChar = "&lt;";
					}else if(_currentChar == ">"){
						_currentChar = "&gt;";
					}else if(_currentChar == ";"){
						//window.alert("fullstop");
					}
					// html END
					if(_currentChar == " "){
						_currentChar = "&nbsp;";
					}else if(_currentChar == "    "){ // find a better way to do this
						_currentChar = "&nbsp;&nbsp;&nbsp;&nbsp;";
					}

					// type controls
					_rowText += _currentChar;
				} // end current row
				if(i < rows.length - 1){
				    // 1 aug 2008
					//_rowText += "<span style=\"visibility:hidden\" tokenType=\"line-terminator\">\u000D</span></div>";
					_rowText += "</div>";
				}
				_parsedContent += _rowText;
				// END new solution 09-23-2007
            } // end rows cycle
            //
            //timeSplit1 = (new Date()).getTime();
            //window.alert("elapsed time: " + (timeSplit1 -timeSplit0));
			var _insertionPoint = this.y,
                newContent = _firstFragment + _parsedContent + _lastFragment
            ;
            if(!dojo.isIE){
            	target.innerHTML = newContent;
            }else{
            	target.innerHTML = "";
            	var container = document.createElement("div");
            	target.appendChild(container);
                // the replace fixes the separators on IE
            	container.outerHTML = newContent.replace(/\s/g, "&nbsp;");
            }
			rowsNum && this._addRowNumber({position: _insertionPoint, rows: _yIncrement});
            if(rowsNum > 1){
                var _delimiters = dojo.query(".dojoCodeTextAreaLines i", this.domNode); // use a better query
                this.removeFromDOM(_delimiters[0]);
            }
            //this.moveCaretAtToken(_delimiters[1], 0);
            var nextY = rowsNum - 1,
                nextX = nextY ? rowLen - this.x : rowLen
            ;
			this.parseLine({ lineIndex: this.y, force: true });
            nextY && this.parseLine({ lineIndex: this.y + nextY, force: true });
			this.moveCaretBy(nextX, nextY);
			//this._removeDelimiter(_delimiters[1]);

			this.currentToken = _savedCurrentToken;
			// lineChanged = true force the currentLine re-read
			this.setCurrentTokenAtCaret({ lineChanged: true });
			if(!content){ return "" }
			dojo.publish(this.id + "::massiveWrite");
			var time1 = (new Date()).getTime();
//			console.log("_massiveWrite " + (time1-time0) + "ms");
			(rowsNum > 1) && this.parseViewport();

			(rowsNum > 1) && this.parseFragment({ startLine: startCoords.y, endLine: this.y, asynch:true}); // remove from here?

			return { data: content, startCoords: startCoords };
		},
        // handles the single token colorization
        colorizeToken: function(/*token*/ currentToken){
            var previousToken = currentToken.previousSibling,
                cDict = this.colorsDictionary
            ;
            if(previousToken){
                previousToken.className = previousToken.firstChild.data in cDict ? cDict[previousToken.firstChild.data].className : "";
                var ppreviousToken = previousToken.previousSibling;
                if(ppreviousToken && ppreviousToken.firstChild){
                    ppreviousToken.className = ppreviousToken.firstChild.data in cDict ? cDict[ppreviousToken.firstChild.data].className : "";
                }
            }
            currentToken.className = currentToken.firstChild.data in cDict ? cDict[currentToken.firstChild.data].className : "";
        },
        showSuggestions: function(){
            var _currentContext = this.getCurrentContext(),
                _contextLength = _currentContext.length,
                _suggestions = this.autocompleteDictionary,
                i = 0
            ;
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
        createPopup: function(/*Object */ items){
            var _items = [];
            for(var i in items){
                _items.push({ value: i, name: i });
            }
            this.suggestionsCombo.store =
                new dojo.data.ItemFileReadStore({data: {items:_items}});
            var _self = this,
                _toComplete = "",
                _targetToken = this.caret
            ;
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
            this.suggestionsCombo.attr("displayedValue", _toComplete);
            this.suggestionsCombo.domNode.style.display = "block";
            dijit.placeOnScreenAroundElement(this.suggestionsCombo.domNode, _targetToken, {'TL' : 'TL'});
            this.suggestionsCombo.focus();

            // bill: can you make _startSearch public? pleeeease! ^__^
            this.suggestionsCombo._startSearch(this.suggestionsCombo.attr("value"));
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
            var keyCode = evt.keyCode,
                charCode = evt.charCode,
                resCode = keyCode || charCode,
                _targetToken = this._targetToken
            ;
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
                this.write(this.suggestionsCombo.attr("value"), true);
                this.attachEvents();
				this.focus();
            }
			dojo.stopEvent(evt);
			evt.preventDefault();
        },
        startPlugins: function(){
            var plugins = this.plugins.split(" ");
            for(var i = 0; i < plugins.length; i++){
                try{
                    if(plugins[i]){
                        nic.widget._codeTextArea.plugins[plugins[i]].startup({source:this});
                    }
                }catch(error){
//                    console.log("plugin \"" + plugins[i] + "\" not found");
                }
            }
        },
        /* private functions */
		_removeDelimiter: function(/*token*/ delimiter){
			this.removeFromDOM(delimiter);
		},
        _getTargetToken: function(/*token*/ startToken){
            /* REFACTOR THIS METHOD!! */
            var _previousToken = startToken.previousSibling,
                _ppreviousToken = _previousToken ? _previousToken.previousSibling : null,
                _pppreviousToken = _ppreviousToken ? _ppreviousToken.previousSibling : null,
                _targetToken
            ;
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
        _removeRowNumber: function(/*integer*/ rowsToRemove){
			var root = this.leftBand.getElementsByTagName("ol")[0];
			this.removeFromDOM(root.getElementsByTagName("li")[rowsToRemove.position + 1]);
		},
        _addRowNumber: function(/*integer*/ rowsToAdd){
			var root = this.leftBand.getElementsByTagName("ol")[0],
                number
            ;
			for(var i = 0, l = rowsToAdd.rows - 1; i < l; i++){
				number = document.createElement("li");
				root.appendChild(number);
			}
        },
		_getRowNumbersCount: function(){
			return this.leftBand.getElementsByTagName("ol").length;
		}
	}
);