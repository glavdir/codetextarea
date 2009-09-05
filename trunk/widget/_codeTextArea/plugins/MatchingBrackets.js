dojo.provide("nic.widget._codeTextArea.plugins.MatchingBrackets");
nic.widget._codeTextArea.plugins.MatchingBrackets = {
	source: null,
	brackets: [],
	currentBrackets: [],
	getX: null,
    startup: function(args){
		var self = this;
		this.source = source = args.source;
		this.getX = this.source.getTokenX;
		dojo.subscribe(source.id + "::newToken", dojo.hitch(this, self.pushBracket));
		dojo.subscribe(source.id + "::CaretMove", dojo.hitch(this, self.setBracketColors));
		dojo.subscribe(source.id + "::removeCharAtCaret", dojo.hitch(this, self.setBracketColors));
		dojo.subscribe(source.id + "::fragmentParsed", dojo.hitch(this, self.makeBracketsList));
	    dojo.subscribe(source.id + "::viewportParsed", dojo.hitch(this, self.makeBracketsList));
		dojo.subscribe(source.id + "::KeyPressed", dojo.hitch(this, self.gotoMatchingBracket));
	},
	isBracket: function(tokenType){
		tokenType = tokenType || "";
		return tokenType.indexOf("bracket") != -1;
	},
	getBracketType: function(token){
		var tokenType = token.getAttribute("tokenType");
		return tokenType.substring(tokenType.indexOf("-") + 1);
	},
	getBracketStatus: function(token){
		var tokenType = token.getAttribute("tokenType");
		return tokenType.substring(0, tokenType.indexOf("-"));
	},
	removeColors: function(){
		var currentBrackets = this.currentBrackets;
		for(var i = 0; i < currentBrackets.length; i++){
			dojo.removeClass(dojo.byId(currentBrackets[i]), "matchingBracket");
		}
		currentBrackets.length = 0;
	},
	makeBracketsList: function(){
		var bracketsToAdd = dojo.query("[tokenType$=bracket]", source.domNode);
		if(!bracketsToAdd.length){
			return;
		}
		this.brackets.length = 0;
		this.brackets = bracketsToAdd;
		this.setBracketColors();
	},
	colorize: function(token){
		console.log(this.brackets);
		var bracketType = this.getBracketType(token),
			status = this.getBracketStatus(token),
			matchingStatus = status == "open" ? "closed" : "open",
			startIndex = -1,
			matchingCounter = 0,
			increment = 1,
			i = 0,
			parsedBrackets = 0,
			brackets = this.brackets
		;
		if(status == "closed"){
			increment = -1;
			i = brackets.length - 1;
		}
		while(parsedBrackets < brackets.length){
			if(startIndex != -1){
				if(this.getBracketStatus(brackets[i]) == matchingStatus){
					if(this.getBracketType(brackets[i]) == bracketType){
						matchingCounter--;
						if(!matchingCounter){
							this.currentBrackets.push(brackets[startIndex]);
							this.currentBrackets.push(brackets[i]);
							break;
						}
					}
				}else{ //same status
					if(this.getBracketType(brackets[i]) == bracketType){
						matchingCounter++;
					}						
				}
			}else{
				if(brackets[i] === token){
					startIndex = i;		
					matchingCounter = 1;				
				}
			}
			parsedBrackets++;
			i += increment;
		}
		if(this.currentBrackets.length == 2){
			for(var i = 0; i < 2; i++){
				dojo.addClass(this.currentBrackets[i], "matchingBracket");
			}
		}else{
			// only one bracket found
			this.currentBrackets.length = 0;
		}		
	},
	setBracketColors: function(){
		this.removeColors();
		var token = this.source.currentToken,
			tokenType = dojo.attr(token, "tokenType")
		;
		if(this.isBracket(tokenType)){
			this.colorize(token);
		}
	},
	deleteRemovedBrackets: function(){
		var brackets = this.brackets;
		for(var i = brackets.length - 1; i >= 0; i--){
			if(!brackets[i].parentNode){
				brackets.splice(i, 1);
			}
		}
	},
	insertBracket: function(bracket){
		var brackets = this.brackets,
			len = brackets.length,
			i = 0
		;
		while(i < len && source.compareTokenPosition({ token:brackets[i], index:0 }, { token:bracket, index:0 }) == -1){
			i++;
		}
		brackets.splice(i, 0, bracket);
	},
	pushBracket:function(args){
		var token = args.token,
			tokenType = args.tokenType
		;
		if(this.isBracket(tokenType)){
			this.deleteRemovedBrackets();
			this.insertBracket(token);
		}
	},
	gotoMatchingBracket: function(data){
		var evt = data.evt,
			currentBrackets = this.currentBrackets;
		;
        if(evt.ctrlKey && evt.charCode == 98){ // ctrl + b
			var tokenType = dojo.attr(this.source.currentToken, "tokenType");
			if(this.isBracket(tokenType)){
				var targetToken = null,
					matchingToken = null
				;
				for(var i = 0; i < currentBrackets.length; i++){
					if(currentBrackets[i] === token){
						matchingToken = currentBrackets[i];																	
					}else{
						targetToken = currentBrackets[i];
					}
				}
				if(targetToken && matchingToken){
					this.source.setCaretPosition(this.getX(targetToken), this.source.indexOf(targetToken.parentNode));
				}
			}
		}		
	}
};
