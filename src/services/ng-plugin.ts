/// <reference path="services.ts"/>
/// <reference path="plugins.ts" />

// Assume we are running in an ES6 environment
interface String {
    endsWith(value: string): boolean;
    startsWith(value: string): boolean;
}

namespace ng {
    interface Mapping {
        isPosInTemplate(pos: number): boolean;
        isPosInGeneratedCode(pos: number): boolean;
        mapPosFromTemplateToGeneratedCode(pos: number): number;
        mapPosFromGeneratedCodeToTemplate(pos: number): number;
    }

    interface ngTemplateNode {
        templateString: ts.Node;
        classDecl: ts.Node;
    }

    interface Map<Value> {
       [index: string]: Value; 
    }

    interface GenerationCacheEntry {
        source: string;
        basedOnVersion: string;
        mapping: Mapping;
    }

    class NgPlugin implements ts.LanguageServicePlugin {
        private ngmlService: ts.LanguageService;
        private cacheVersion: string;
        private generatedFiles: Map<GenerationCacheEntry> = {};
        private generation: number = 0;
             
        constructor(
            private tsService: ts.LanguageService,
            private host: ts.LanguageServiceHost, 
            private registry: ts.DocumentRegistry) {
            
            // Create a host that will return snapshots of the generated files but, 
            // otherwise, delegates all the behavior to the given host.
            let createProxy = (host: ts.LanguageServiceHost): ts.LanguageServiceHost => {
                var result: ts.LanguageServiceHost = {
                    getCompilationSettings: () => host.getCompilationSettings(),
                    getScriptFileNames: () => host.getScriptFileNames(),
                    getScriptVersion: fileName => host.getScriptVersion(fileName),
                    getScriptSnapshot: fileName => {
                        const generatedFile = this.generatedFiles[fileName];
                        const snapString = (s: string): ts.IScriptSnapshot => ({
                            getText: (start, end) => s.substring(start, end),
                            getLength: () => s.length,
                            getChangeRange: () => undefined                            
                        });
                        if (generatedFile) {
                            return snapString(generatedFile.source);
                        }
                        return host.getScriptSnapshot(fileName);
                    },
                    getCurrentDirectory: () => host.getCurrentDirectory(),
                    getDefaultLibFileName: options => host.getDefaultLibFileName(options)          
                }
                if (host.getNewLine)
                    result.getNewLine = () => host.getNewLine();
                if (host.getProjectVersion)
                    result.getProjectVersion = () => `${host.getProjectVersion()}.${this.generation}`;
                if (host.getCancellationToken)
                    result.getCancellationToken = () => host.getCancellationToken();
                if (host.log)
                    result.log = s => host.log(s);
                if (host.trace)
                    result.trace = s => host.trace(s);
                if (host.error)
                    result.trace = s => host.error(s);
                if (host.useCaseSensitiveFileNames)
                    result.useCaseSensitiveFileNames = () => host.useCaseSensitiveFileNames();
                if (host.resolveModuleNames)
                    result.resolveModuleNames = (moduleNames, containingFile) => host.resolveModuleNames(moduleNames, containingFile);
                if (host.directoryExists)
                    result.directoryExists = directoryName => host.directoryExists(directoryName);
                return result;
            }

            let localRegistry = ts.createDocumentRegistry();

            this.ngmlService = ts.createLanguageService(createProxy(host), localRegistry);
        }
        
        // Implementation of ts.LanguageServicePlugin
        
        getCompletionsAtPosition(fileName: string, position: number) : ts.CompletionInfo {
            let sourceFile = this.getValidSourceFile(fileName);

            // Does it contain an Angular template at the position requested? If not, exit.
            let templatesInFile = getNgTemplateStringsInSourceFile(sourceFile);
            if (!getTemplateAtPosition(templatesInFile, position)) {
                return undefined;
            }

            return this.getNgTemplateCompletionsAtPosition(fileName, position,
                (fileName, pos) => this.ngmlService.getCompletionsAtPosition(fileName, pos));
        }

        getCompletionEntryDetails(fileName: string, position: number, entryName: string) {
            return this.fromGeneratedFile(fileName, position,
                (fileName, position) => this.ngmlService.getCompletionEntryDetails(fileName, position, entryName));
        }
        
        getSyntacticDiagnosticsFilter(fileName: string, previous: ts.Diagnostic[]): ts.Diagnostic[] {
            let result: ts.Diagnostic[] = [];
            let sourceFile = this.getValidSourceFile(fileName);

            getNgTemplateStringsInSourceFile(sourceFile).forEach( elem => {
                let text = elem.templateString.getText();
                text = text.substring(1, text.length - 1);
                addTemplateErrors(text, elem.templateString.getStart() + 1);
            });

            function addTemplateErrors(text: string, offset: number){
                let parser = new NgTemplateParser(text);
                parser.errors.forEach( err => {
                    let parts = err.split(':');
                    // TODO: Change the errors in the parser to match expected Diagnostic fields
                    let diag: ts.Diagnostic = {
                        file: sourceFile,
                        start: parseInt(parts[1]) + offset,
                        length: parseInt(parts[2]) - parseInt(parts[1]),
                        messageText: parts[3].trim(),
                        category: ts.DiagnosticCategory.Warning,
                        code: 1
                    }
                    result.push(diag);
                });
            }

            if (result.length) {
                return previous.concat(result);
            }
            return undefined
        }

        getQuickInfoAtPosition(fileName: string, position: number): ts.QuickInfo {
            return this.fromGeneratedFile(fileName, position, (fileName, position, mapping) => {
               const result = this.ngmlService.getQuickInfoAtPosition(fileName, position);
               if (result && mapping.isPosInGeneratedCode(result.textSpan.start)) {
                   result.textSpan.start = mapping.mapPosFromGeneratedCodeToTemplate(result.textSpan.start);
               }
               return result;
            });
        }

       getDefinitionAtPosition(fileName: string, position: number): ts.DefinitionInfo[] {
           return this.fromGeneratedFile(fileName, position, (fileName, position, mapping) => {
                const result = this.ngmlService.getDefinitionAtPosition(fileName, position);
                if (result) {
                    result.forEach(definition => {
                        const startPos = definition.textSpan.start;
                        if (definition.fileName === fileName && mapping.isPosInGeneratedCode(startPos)) {
                            definition.textSpan.start = mapping.mapPosFromGeneratedCodeToTemplate(startPos);
                        }
                    });
                }
                return result;
           });
        }

        // Private implementation methods

        private getCurrentProgram(): ts.Program {
            return this.tsService.getProgram();
        }

        private fromGeneratedFile<T>(fileName: string, position: number,
            callback: (fileName: string, position: number, mapping: Mapping) => T): T {
            let sourceFile = this.getValidSourceFile(fileName);

            // Does it contain an Angular template at the position requested?
            let templatesInFile = getNgTemplateStringsInSourceFile(sourceFile);
            if (!getTemplateAtPosition(templatesInFile, position))
                return undefined;

            // Generate the file if it hasn't been generated or the generated
            // version is out of date.
            let generatedFileInfo = this.generatedFiles[fileName];
            if (generatedFileInfo) {
                if (sourceFile.version != generatedFileInfo.basedOnVersion)
                    generatedFileInfo = undefined;
            }
            if (!generatedFileInfo) {
                const {generatedFile, mapping, sourceText} = this.getGeneratedFile(sourceFile, templatesInFile);
                generatedFileInfo = {source: sourceText, mapping, basedOnVersion: sourceFile.version};
                this.generatedFiles[fileName] = generatedFileInfo;
                this.generation++;
            }

            // Find the position generated in the source for the requested position in the template.
            const generatedPos = generatedFileInfo.mapping.mapPosFromTemplateToGeneratedCode(position);
            return callback(fileName, generatedPos, generatedFileInfo.mapping);
        }

        private getNgTemplateCompletionsAtPosition(fileName: string, position: number,
            queryGeneratedCode: (fileName: string, pos: number) => ts.CompletionInfo): ts.CompletionInfo {
            // This function should:
            // - Check it is in a template string
            // - If so, see if it is in a start tag name, attribute name, expression, or close tag.
            // - For an open tag, return the list of tags available (+ next expected close tag)
            // - For a close tag, return the next expected close tag
            // - For an attribute name, return the list of properties for the tag type
            // - For an expression, return the completions for the mapped expression location in the generated code
            let typeChecker = this.getCurrentProgram().getTypeChecker();
            let sourceFile = this.getValidSourceFile(fileName);
	        let that = this; 
            let templatesInFile = getNgTemplateStringsInSourceFile(sourceFile);
            let templateNode = getTemplateAtPosition(templatesInFile, position);
            if(!templateNode){
                return undefined;
            }

            // Parse the template string into an AST and see what position we're in
            let text = templateNode.templateString.getText();
            text = text.substring(1, text.length - 1); // Strip the surrounding back-ticks
            let htmlParser = new NgTemplateParser(text);
            let posInTemplate = position - (templateNode.templateString.getStart() + 1)
            let currNode = htmlParser.getNodeAtPosition(posInTemplate);

            let elements: ts.CompletionEntry[];

            function getExpressionCompletions(text: string, pos: number){
                if(isAfterDot(text, pos)){
                    // We use position instead of pos because the pos passed in is just
                    // meant to be used for isAfterDot. fromGeneratedFile() requires the
                    // original position.
                    const result = that.fromGeneratedFile(fileName, position, queryGeneratedCode);
                    if (result) {
                        return result.entries;
                    }
                    return undefined;
                } else {
                    // TODO: Should include locally introduced names also (e.g. #player)
                    return getClassMembers(typeChecker, templateNode.classDecl);
                }
            }

            switch(currNode.kind){
                case ngNodeKind.StartTag:
                case ngNodeKind.SelfClosingTag:
                    elements = getElementCompletions();
                    if(currNode.parent.name !== '__root__'){
                        elements.unshift({
                            name: '/' + currNode.parent.name,
                            kind: ts.ScriptElementKind.classElement,
                            kindModifiers: "",
                            sortText: "0"
                        });
                    }
                    break;
                case ngNodeKind.EndTag:
                    elements = [{
                        name: currNode.parent.name,
                        kind: ts.ScriptElementKind.classElement,
                        kindModifiers: "",
                        sortText: "0"
                    }];
                    break;
                case ngNodeKind.Attribute:
                    if(posInTemplate >= (currNode as NgAttrib).valuePos){
                        // If we're after a '.', delegate to getCompletions for the location in the generated code
                        let attribValue = (currNode as NgAttrib).value;
                        let attribPos = posInTemplate - (currNode as NgAttrib).valuePos;
                        elements = getExpressionCompletions(attribValue, attribPos);
                    } else if((currNode as NgAttrib).name[0] === '*'){
                        elements = getDirectiveCompletions();
                    } else {
                        // Get the parent tag name, the type for that, and the members of that type
                        let parentTagType = tagToType[currNode.parent.name];
                        if(!parentTagType){
                            elements = getDummyCompletions();
                            break;
                        }

                        // HTMLDivElement etc. are declared as variables
                        // TODO: Handle custom elements, which will be classes
                        let inScopeSymbols = typeChecker.getSymbolsInScope(templateNode.templateString, ts.SymbolFlags.Interface);
                        if(!inScopeSymbols || inScopeSymbols.length == 0){
                            elements = getDummyCompletions();
                            break;
                        }
                        if(!inScopeSymbols.some( sym => {
                            if(sym.name === parentTagType){
                                let declType = typeChecker.getDeclaredTypeOfSymbol(sym);
                                let members = declType.getProperties();
                                elements = members.map(member => ({
                                    name: member.name,
                                    kind: member.flags & ts.SymbolFlags.Method ? ts.ScriptElementKind.memberFunctionElement : ts.ScriptElementKind.memberVariableElement,
                                    kindModifiers: "",
                                    sortText: "0"
                                }));

                                // Filter from event bindings to 'on*' members and remove the on.
                                if((currNode as NgAttrib).name[0] === '('){
                                    elements = elements.filter( elem => {
                                        if(elem.name.length > 2 && elem.name.substring(0,2) === 'on'){
                                            elem.name = elem.name.substring(2);
                                            return true;
                                        }
                                        return false;
                                    });
                                }
                                // Filter data bindings to only be data properties, not methods/event handlers
                                if((currNode as NgAttrib).name[0] === '['){
                                    elements = elements.filter( elem => (elem.kind === ts.ScriptElementKind.memberVariableElement));
                                }
                                return true;
                            }
                        })){
                            elements = getDummyCompletions();
                        }
                    }
                    break;
                case ngNodeKind.Interpolation:
                    let interpText = (currNode as NgNode).getText().substring(2);
                    let pos = posInTemplate - currNode.startPos - 2;
                    elements = getExpressionCompletions(interpText, pos);
                    break;
            }

            var result: ts.CompletionInfo = {
                isMemberCompletion: false,
                isNewIdentifierLocation: false,
                entries: elements
            }
            return result;
        }        

        private normalizeName(fileName: string): string {
            let normalName = ts.normalizeSlashes(fileName);
            let getCanonicalFileName = ts.createGetCanonicalFileName(/* useCaseSensitivefileNames */ false);
            return getCanonicalFileName(normalName);
        }

        private getValidSourceFile(fileName: string): ts.SourceFile {
            let sourceFile = this.getCurrentProgram().getSourceFile(this.normalizeName(fileName));
            if (!sourceFile) {
                throw new Error("Could not find file: '" + fileName + "'.");
            }
            return sourceFile;
        }
        
	   private getGeneratedFile(originalFile: ts.SourceFile, templatesInFile: ngTemplateNode[]) {
            // TODO: Just does the first template for now. Update to handle multiple per file
            if(!templatesInFile || templatesInFile.length === 0) return undefined;

            // Find the first (if any) template string for this position
            let ngTemplate = templatesInFile[0];

            // Generate a source file with the generated template code, and map to the position in that
            let text = ngTemplate.templateString.getText();
            text = text.substring(1, text.length - 1); // Strip the surrounding back-ticks
            let htmlParser = new NgTemplateParser(text);

            // Get the name of the class and generate the stub function
            let className = ngTemplate.classDecl.symbol.name;
            let generatedFunc = generateFunction(htmlParser.ast, className);

            // Generate a source file with the injected content and get errors on it
            let insertionPoint = ngTemplate.classDecl.getEnd();
            let oldText = originalFile.getText();
            let newText = `${oldText.substring(0, insertionPoint)}\n${generatedFunc}\n${oldText.substring(insertionPoint)}`;
            let endNewText = insertionPoint + generatedFunc.length + 2;
            let newSourceFile = ts.createSourceFile(originalFile.fileName, newText, originalFile.languageVersion, true);

            let mapping: Mapping = {
                isPosInTemplate: (position) => position > ngTemplate.templateString.getStart() && position < ngTemplate.templateString.getEnd(),
                isPosInGeneratedCode: (position) => position > insertionPoint && position < endNewText,
                mapPosFromGeneratedCodeToTemplate: (position) => {
                    let posOffsetInCodeGen = position - insertionPoint - 1;
                    let mappedPos = mapPosViaMarkers(generatedFunc, posOffsetInCodeGen, true);
                    if(mappedPos.pointInTemplate === -1){
                        // Didn't find it. Just return the start of the template string.
                        return ngTemplate.templateString.getStart() + 1;
                    } else {
                        return mappedPos.pointInTemplate += ngTemplate.templateString.getStart() + 1;
                    }
                },
                mapPosFromTemplateToGeneratedCode: (position) => {
                    let posOffsetInTemplate = position - (ngTemplate.templateString.getStart() + 1);

                    // See if this maps to a location in the generated code
                    let mappedPos = mapPosViaMarkers(generatedFunc, posOffsetInTemplate);
                    if(mappedPos.pointInGenCode === -1) {
                        if(position >= endNewText){
                            position += generatedFunc.length + 2;
                        }
                        return position;
                    } else {
                        mappedPos.pointInGenCode += insertionPoint + 1;
                        return mappedPos.pointInGenCode;
                    }
                }
            };

            return {generatedFile: newSourceFile, mapping, sourceText: newText};
        }        
    }
    
    function getNgTemplateStringsInSourceFile(sourceFile: ts.SourceFile) : ngTemplateNode[] {
        let result: ngTemplateNode[] = [];

        // Find each template string in the file
        ts.forEachChild(sourceFile, visit);
        function visit(child: ts.Node){
            if(child.kind === ts.SyntaxKind.FirstTemplateToken){
                // Ensure it is a Angular template string
                let classDecl = getNgTemplateClassDecl(child);
                if(classDecl){
                    result.push({templateString: child, classDecl});
                }
            } else {
                ts.forEachChild(child, visit);
            }
        }

        return result;
    }
     
    // Given a template string node, see if it is an Angular template string, and if so return the containing class.
    function getNgTemplateClassDecl(currentToken: ts.Node){
        // Verify we are in a 'template' property assignment, in an object literal, which is an call arg, in a decorator
        let parentNode = currentToken.parent;  // PropertyAssignment
        if(!parentNode){
            return undefined;
        }
        if(parentNode.kind !== ts.SyntaxKind.PropertyAssignment){
            return undefined;
        } else {
            // TODO: Is this different for a literal, i.e. a quoted property name like "template"?
            if((parentNode as any).name.text !== 'template'){
                return undefined;
            }
        }
        parentNode = parentNode.parent; // ObjectLiteralExpression
        if(!parentNode || parentNode.kind !== ts.SyntaxKind.ObjectLiteralExpression){
            return undefined;
        }

        parentNode = parentNode.parent; // CallExpression
        if(!parentNode || parentNode.kind !== ts.SyntaxKind.CallExpression){
            return undefined;
        }

        let decorator = parentNode.parent; // Decorator
        if(!decorator || decorator.kind !== ts.SyntaxKind.Decorator){
            return undefined;
        }

        let classDecl = decorator.parent; // ClassDeclaration
        if(!classDecl || classDecl.kind !== ts.SyntaxKind.ClassDeclaration){
            return undefined;
        }
        return classDecl;
    }
    
    // Given an array of templates from a file, location the one containing the given position
    function getTemplateAtPosition(templates: ngTemplateNode[], position: number) : ngTemplateNode {
        let ngTemplate: ngTemplateNode = null;
        templates.some( elem => {
            if(elem.templateString.getStart() < position && elem.templateString.getEnd() >= position){
                ngTemplate = elem;
                return true;
            }
            return false;
        });
        return ngTemplate;
    }
    
    // Detect if we're in a member completion position, rather than an identifier
	// TODO: Crude logic.
	function isAfterDot(expr: string, pos: number): boolean {
		while(--pos > 0){
			if(expr[pos] === '.') return true;
			if(!ts.isIdentifierPart(expr.charCodeAt(pos), ts.ScriptTarget.ES2015)) {
				return false;
			}
		}
		return false;
	}

 	function getClassMembers(typeChecker: ts.TypeChecker, classDecl: ts.Node): ts.CompletionEntry[]{
		let classSymbol = typeChecker.getTypeAtLocation(classDecl) as ts.InterfaceType;
		let classProps = classSymbol.thisType.getProperties();

		var members: ts.CompletionEntry[] = classProps.map(prop => ({
			name: prop.getName(),
			kind: ts.ScriptElementKind.memberVariableElement,
			kindModifiers: "",
			sortText: "0"
		}));
		return members;
	}

    function generateFunction(ast: NgNode, componentType: string): string {
		type nameTable = string[]; // Maps name to type
		var availableGlobals: nameTable = []; // None, I believe.
		var nameScopes: nameTable[] = [availableGlobals];
		let body = "";

		if(ast){
			let indent = '  ';
			body = processNode(ast as NgTag);
			function processNode(node: NgTag): string {
				let map: {[index: string]: string} = {};
				let locals: {[index: string]: string} = {};
				let blocks: string[] = [];
				let statements: string[] = [];
				let names: nameTable = [];
				nameScopes.push(names);
				node.children.forEach( child => {
					if(child.kind == ngNodeKind.StartTag || child.kind == ngNodeKind.SelfClosingTag){
						// Declare a local of each tag type needed.
						let tagNode = child as NgTag;
						let tagType = tagToType[tagNode.name];
						if(!tagType) tagType = "HTMLElement";
						map[tagNode.name] = `let __${tagNode.name} = new ${tagType}();\n`;

						// Add any local names introduced
						tagNode.attributes.forEach( attrib => {
							if(attrib.name[0] == '#' && !attrib.value){
								// TODO: This removes/hides duplicate identifier errors if a local is used twice
								let attribName = fixupName(attrib.name.substring(1));
								let nameText = `/*{start:${attrib.startPos}}*/${attribName}/*{end:${attrib.startPos + attrib.name.length}}*/`
								locals[attribName] = `let ${nameText} = __${tagNode.name};\n`
								names.push(attribName);
							}
						});

						// Declare a statement block for each element also.
						let block = indent + '{\n';
						let oldIndent = indent;
						indent += '  ';
						// Skip empty blocks
						let blockText = processNode(tagNode);
						block += blockText;
						indent = oldIndent;
						block += indent + '}\n';
						if(blockText.trim()) {
							blocks.push(block);
						}
					} else if(child.kind == ngNodeKind.Interpolation){
						let expr = child.getText();
						expr = expr.substring(2, expr.length - 2); // Trim the {{-}}
						expr = indent + `(${bindNames(expr, child.startPos + 2, child.endPos - 2)});\n`;
						statements.push(expr);
					}
				});
				node.attributes.forEach( attrib => {
					if((attrib.name[0] == '[' || attrib.name[0] == '(') && attrib.value){
						// Data or event binding
						let isEvent = attrib.name[0] == '(';
						let name = attrib.name.substring(1, attrib.name.length - 1);
						name = fixupName(name, isEvent);
						let value = bindNames(attrib.value, attrib.valuePos, attrib.valuePos + attrib.value.length);
						let tagName = attrib.parent.name;
						let markedName = `/*{start:${attrib.startPos + 1}}*/${name}/*{end:${attrib.startPos + attrib.name.length - 1}}*/`;
						if(isEvent){
							statements.push(indent + `__${tagName}.${markedName} = $event => ${value};\n`);
						} else {
							statements.push(indent + `__${tagName}.${markedName} = ${value};\n`);
						}
					} else {
						// TODO: Handle interpolation inside attributes here, or add a specific child node?
					}
				});
				nameScopes.pop();

				let result = "";
				for(let key in map){
					result += indent + map[key];
				}
				for(let key in locals){
					result += indent + locals[key];
				}
				statements.forEach(line => result += line);
				blocks.forEach(block => result += block);
				return result;
			}

			function fixupName(name: string, isEvent: boolean = false) : string {
				let result = name;
				if(isEvent){
					result = 'on' + result;
				}
				return result;
			}

			function bindNames(expr: string, start: number, end: number): string {
				// TODO: Need to break this apart to find each identifier. Just handles a raw name to first separator for now.
				let name = expr;
				[' ', '.', '('].forEach(char => {
					let trimAt = name.indexOf(char);
					if(trimAt !== -1){
						name = name.substring(0, trimAt);
					}
				});

				for(let i = nameScopes.length - 1; i > 0; i--){
					let scope = nameScopes[i];
					if(scope.indexOf(name) !== -1){
						// It's declared in an outscope scope. Use it directly
						return `/*{start:${start}}*/${expr}/*{end:${end}}*/`;
					}
				}
				// Bind it to the component instance
				return expr.replace(name, "__comp." + `/*{start:${start}}*/${name}`) + `/*{end:${end}}*/`;
			}
		}

		return `(function(__comp: ${componentType}){
${body}})(null);`;
	}
    
    // TODO: Should create one of these per component/parser, as each may add custom tags
	let tagToType: {[index: string]: string} = {
		// Copied from the createElement overloads in lib.d.ts
		"a": "HTMLAnchorElement",
		"abbr": "HTMLPhraseElement",
		"acronym": "HTMLPhraseElement",
		"address": "HTMLBlockElement",
		"applet": "HTMLAppletElement",
		"area": "HTMLAreaElement",
		"audio": "HTMLAudioElement",
		"b": "HTMLPhraseElement",
		"base": "HTMLBaseElement",
		"basefont": "HTMLBaseFontElement",
		"bdo": "HTMLPhraseElement",
		"big": "HTMLPhraseElement",
		"blockquote": "HTMLBlockElement",
		"body": "HTMLBodyElement",
		"br": "HTMLBRElement",
		"button": "HTMLButtonElement",
		"canvas": "HTMLCanvasElement",
		"caption": "HTMLTableCaptionElement",
		"center": "HTMLBlockElement",
		"cite": "HTMLPhraseElement",
		"code": "HTMLPhraseElement",
		"col": "HTMLTableColElement",
		"colgroup": "HTMLTableColElement",
		"datalist": "HTMLDataListElement",
		"dd": "HTMLDDElement",
		"del": "HTMLModElement",
		"dfn": "HTMLPhraseElement",
		"dir": "HTMLDirectoryElement",
		"div": "HTMLDivElement",
		"dl": "HTMLDListElement",
		"dt": "HTMLDTElement",
		"em": "HTMLPhraseElement",
		"embed": "HTMLEmbedElement",
		"fieldset": "HTMLFieldSetElement",
		"font": "HTMLFontElement",
		"form": "HTMLFormElement",
		"frame": "HTMLFrameElement",
		"frameset": "HTMLFrameSetElement",
		"h1": "HTMLHeadingElement",
		"h2": "HTMLHeadingElement",
		"h3": "HTMLHeadingElement",
		"h4": "HTMLHeadingElement",
		"h5": "HTMLHeadingElement",
		"h6": "HTMLHeadingElement",
		"head": "HTMLHeadElement",
		"hr": "HTMLHRElement",
		"html": "HTMLHtmlElement",
		"i": "HTMLPhraseElement",
		"iframe": "HTMLIFrameElement",
		"img": "HTMLImageElement",
		"input": "HTMLInputElement",
		"ins": "HTMLModElement",
		"isindex": "HTMLIsIndexElement",
		"kbd": "HTMLPhraseElement",
		"keygen": "HTMLBlockElement",
		"label": "HTMLLabelElement",
		"legend": "HTMLLegendElement",
		"li": "HTMLLIElement",
		"link": "HTMLLinkElement",
		"listing": "HTMLBlockElement",
		"map": "HTMLMapElement",
		"marquee": "HTMLMarqueeElement",
		"menu": "HTMLMenuElement",
		"meta": "HTMLMetaElement",
		"nextid": "HTMLNextIdElement",
		"nobr": "HTMLPhraseElement",
		"object": "HTMLObjectElement",
		"ol": "HTMLOListElement",
		"optgroup": "HTMLOptGroupElement",
		"option": "HTMLOptionElement",
		"p": "HTMLParagraphElement",
		"param": "HTMLParamElement",
		"plaintext": "HTMLBlockElement",
		"pre": "HTMLPreElement",
		"progress": "HTMLProgressElement",
		"q": "HTMLQuoteElement",
		"rt": "HTMLPhraseElement",
		"ruby": "HTMLPhraseElement",
		"s": "HTMLPhraseElement",
		"samp": "HTMLPhraseElement",
		"script": "HTMLScriptElement",
		"select": "HTMLSelectElement",
		"small": "HTMLPhraseElement",
		"source": "HTMLSourceElement",
		"span": "HTMLSpanElement",
		"strike": "HTMLPhraseElement",
		"strong": "HTMLPhraseElement",
		"style": "HTMLStyleElement",
		"sub": "HTMLPhraseElement",
		"sup": "HTMLPhraseElement",
		"table": "HTMLTableElement",
		"tbody": "HTMLTableSectionElement",
		"td": "HTMLTableDataCellElement",
		"textarea": "HTMLTextAreaElement",
		"tfoot": "HTMLTableSectionElement",
		"th": "HTMLTableHeaderCellElement",
		"thead": "HTMLTableSectionElement",
		"title": "HTMLTitleElement",
		"tr": "HTMLTableRowElement",
		"track": "HTMLTrackElement",
		"tt": "HTMLPhraseElement",
		"u": "HTMLPhraseElement",
		"ul": "HTMLUListElement",
		"var": "HTMLPhraseElement",
		"video": "HTMLVideoElement",
		"x-ms-webview": "MSHTMLWebViewElement",
		"xmp": "HTMLBlockElement"
	};
    
	function stripMarkers(input: string){
		return input.replace(/\/\*\{(start|end):\d+}\*\//g, "");
	}

	interface CodeMapping {
		pointInTemplate: number;
		startRangeInTemplate: number;
		endRangeInTemplate: number;
		pointInGenCode: number;
		startRangeInGenCode: number;
		endRangeInGenCode: number;
	}

	// This function is given the generated code with the markers, and a position from the template to try
	// and location within it. It searches the markers to see if the position from the template maps to a
	// location in the generated code.
	// To do the reverse (map a point in the generated code to the template), is also iterates through the
	// markers in the generated code, and sees if the point is within a start/end marker span in the generated code.
	function mapPosViaMarkers(input: string, pos: number, codeToTemplate: boolean = false): CodeMapping {
		let result: CodeMapping = {
			pointInTemplate: codeToTemplate ? -1 : pos,
			startRangeInTemplate: -1,
			endRangeInTemplate: -1,
			pointInGenCode: codeToTemplate ? pos : -1,
			startRangeInGenCode: -1,
			endRangeInGenCode: -1
		};

		// We want to find the start/end markers separately to easily get lastIndexOf as the first position after the start marker
		let startMarker = /\/\*\{start:(\d+)}\*\//g;
		let endMarker = /\/\*\{end:(\d+)}\*\//g;

		let startResult: RegExpExecArray = null;
		let endResult: RegExpExecArray = null;
		while(startResult = startMarker.exec(input)){
			// Always advance in pairs
			endResult = endMarker.exec(input);
			let startPos = parseInt(startResult[1]);
			let endPos = parseInt(endResult[1]);
			if(codeToTemplate){
				// Is the pos within the marker locations?
				if(pos >= startMarker.lastIndex && pos < endMarker.lastIndex){
					result.startRangeInTemplate = startPos;
					result.endRangeInTemplate = endPos;
					result.startRangeInGenCode = startMarker.lastIndex;
					result.endRangeInGenCode = endMarker.lastIndex - (endResult[0].length);
					result.pointInTemplate = startPos + (pos - startMarker.lastIndex);
					// Ensure we don't overrun the mapping due to renames
					if(result.pointInTemplate > endPos) {
						result.pointInTemplate = endPos;
					}
					break;
				}
			} else {
				// Is the pos within the marker values?
				if(pos >= startPos && pos <= endPos){
					// Found a range that matches.
					result.pointInGenCode = startMarker.lastIndex + (pos - startPos);
					result.startRangeInTemplate = startPos;
					result.endRangeInTemplate = endPos;
					result.startRangeInGenCode = startMarker.lastIndex;
					result.endRangeInGenCode = endMarker.lastIndex - (endResult[0].length);
					// Ensure we don't overrun the mapping due to renames
					if(result.pointInGenCode > result.endRangeInGenCode) {
						result.pointInGenCode = result.endRangeInGenCode;
					}
					break;
				}
			}
		}

		return result;
	}

	// This function is used for mapping an error in the generated code, to a range in the template code.
	// It basically takes the range of the error, and finds the first range in the template with some overlap.
	function findFirstOverlap(input: string, startPos: number, endPos: number){
		// Loop though the input finding range marker pairs.
		let markerPairRegex = /\/\*\{start:(\d+)}\*\/.+?\/\*\{end:(\d+)}\*\//g;
		let markerPairResult: RegExpExecArray = null;

		while(markerPairResult = markerPairRegex.exec(input)){
			// When found, see if the span of that range intersects with the range given.
			let endMatch = markerPairRegex.lastIndex;
			let startMatch = endMatch - markerPairResult[0].length;
			if(endMatch >= startPos && startMatch <= endPos){
				// If so, return the range as specified by the markers.
				let startRange = parseInt(markerPairResult[1]);
				let endRange = parseInt(markerPairResult[2]);
				return {startRange, endRange};
			}
		}
		return null;
	}
    
    // TODO: The below are to return a collection of mock completions for now...
    function getElementCompletions(): ts.CompletionEntry[]{
		return Object.keys(tagToType).map( name => ({
                name,
                kind: ts.ScriptElementKind.classElement,
                kindModifiers: "",
                sortText: "0"
        }));
    }
    
    function getDirectiveCompletions(): ts.CompletionEntry[]{
        return ["ngFor", "ngIf", "ngSwitch"].map( name => ({
                name,
                kind: ts.ScriptElementKind.keyword,
                kindModifiers: "",
                sortText: "0"
        }));
    }

	function getDummyCompletions(): ts.CompletionEntry[]{
        return ["sausage", "bacon", "eggs"].map( name => ({
                name,
                kind: ts.ScriptElementKind.label,
                kindModifiers: "",
                sortText: "0"
        }));
    }

	// A rudimentary parser for Angular templates
	// It expects the HTML to be well formed, i.e. self closing or matched tags, not unmatched like <br>.
	// It has a startPos, which is the first significant character, and a fullStartPos, which is immediately after the proceeding token.
	// Every char is part of a token. Any trailing space would be a 'Text' token.
    // TODO: Replace with the Angular implementation

	export enum ngNodeKind {
		Root,         // Enclosing document. No name or attributes, just children.
		SelfClosingTag,
		StartTag,
		Attribute,
		EndTag,
		Text,
		Comment,      // Includes enclosing <!-- & -->
		Interpolation // Includes enclosing {{ & }}
	}

	export interface NgNode {
		kind: ngNodeKind,
		fullStartPos: number; // Includes leading whitespace
		startPos: number;
		endPos: number; // Position after final char. Text length = endPos - startPos
		parent: NgTag;
		getText?: () => string;
	}

	export interface NgNamedNode extends NgNode {
		name: string; // Used directly for closing tags
	}

	export interface NgTag extends NgNamedNode {
		attributes: NgAttrib[];
		children: NgNode[]; // Final child will be closing tag for non-self-closing tags
	}

	// TODO: Have a flag to indicate if the value is an expression, and maybe an AST property if it is.
	export interface NgAttrib extends NgNamedNode {
		value?: string;
		valuePos?: number;
	}

    export class NgTemplateParser {
		// TODO: Make ascii case-insensitive for element & attribute names
		currentPos: number;
		ast: NgTag;
		errors: string[];
		stats = {
			openTags: 0,
			closeTags: 0,
			selfClosingTags: 0,
			attributes: 0,
			comments: 0,
			interpolations: 0,
			textNodes: 0,
			totalNodes: function(){ return this.openTags + this.closeTags + this.selfClosingTags +
				this.attributes + this.comments + this.interpolations + this.textNodes;}
		};

		// Creating a new scanner will automatically populate the AST and error list.
		constructor(public text: string){
			this.currentPos = 0;
			this.errors = [];
			this.ast = this.scan();
		}

		getNodeText(node: NgNode){
			return this.text.substring(node.startPos, node.endPos);
		}

		private getChar(offset: number = 0){
			if(this.currentPos + offset >= this.text.length){
				return '\x00';
			} else {
				let result = this.text[this.currentPos + offset];
				this.currentPos += (offset + 1);
				return result;
			}
		}

		private peekChar(offset: number = 0){
			if(this.currentPos + offset >= this.text.length){
				return '\x00';
			} else {
				return this.text[this.currentPos + offset];
			}
		}

		scan(): NgTag{
			if(!this.text) {
				return null;
			}

			var root: NgTag = {
				kind: ngNodeKind.Root,
				fullStartPos: 0,
				startPos: 0,
				endPos: 0,
				name: "__root__",
				attributes: [],
				children: [],
				parent: null
			}

			/*
			Effectively we start by pushing the root node on the stack, and scanning for children (parseTagChildren).
			findNextChild iteratively looks for a comment, text, interpolation, or tag, until it reaches an close tag (the parent's) or EOF.
			findNextChild pushes each child it finds onto the 'childen' array of the current top of stack.

			Parsing of text simply runs to the next "<", ">" or "{{"
			Parsing of an interpolation runs until the next "}}"
			Parsing of a comment runs to the closing "-->"

			When an tag start is found, parseTag is called.
			ParseTag pushes itself on the stack, and calls parseTagAttributes until it encounters "/>" or ">".
			If it encounters "/>", it completes the tag and returns.
			If it encounters ">", it calls parseTagChildren.
			*/


			var stack: NgTag[] = [root];
			let nextChild: NgNode;
			while(nextChild = this.findNextChild()){
				nextChild.parent = stack[stack.length - 1];
				stack[stack.length - 1].children.push(nextChild);
				// For open or close tags, move up or down the stack
				switch(nextChild.kind){
					case ngNodeKind.StartTag:
						// Start of child tag found, make the top of the stack.
						stack.push(nextChild as NgTag);
						break;
					case ngNodeKind.EndTag:
						if((nextChild as NgNamedNode).name === (stack[stack.length - 1].name)){
							// Close tag for current top of stack. Pop from stack, add as final child, and continue
							stack.pop();
						} else {
							let msg = (stack.length > 1) ?
									`Expected closing tag named "${stack[stack.length - 1].name}"` :
									`Unexpected closing tag`;

							this.errors.push(`html:${nextChild.startPos}:${this.currentPos}: ${msg}`);
						}
						break;
					default:
						// Add the child node to the current tag on top of stack
						break;
				}
			}

			// Check for unmatched tags
			while(true){
				let unmatched = stack.pop();
				if(!unmatched || unmatched === root) break;
				this.errors.push(`html:${unmatched.startPos}:${unmatched.endPos}: Unmatched opening tag`)
			}

			return root;
		}

		findNextChild(): NgNode {
			let fullStartPos = this.currentPos;
			this.skipWhitespace();
			let ch = this.getChar();
			switch(ch){
				case '\x00':
					// Did we have trailing text or not?
					if(this.currentPos === fullStartPos){
						return null;
					} else {
						this.stats.textNodes++;
						return {
							kind: ngNodeKind.Text,
							fullStartPos: fullStartPos,
							startPos: this.currentPos,
							endPos: this.currentPos,
							parent: null
						}
					}
				case '<':
					if(this.peekChar(0) === '!' && this.peekChar(1) === '-' && this.peekChar(2) === '-'){
						return this.parseComment(fullStartPos);
					} else if(this.peekChar(0) === '/') {
						return this.parseCloseTag(fullStartPos);
					} else return this.parseTag(fullStartPos);
				case '{':
					// Check for "{{"
					if(this.peekChar(0) === '{'){
						return this.parseInterpolation(fullStartPos);
					} else {
						return this.parseText(fullStartPos);
					}
				default:
					return this.parseText(fullStartPos);
			}
		}

		parseComment(fullStartPos: number): NgNode {
			let result: NgNode = {
				kind: ngNodeKind.Comment,
				fullStartPos: fullStartPos,
				startPos: this.currentPos - 1,
				endPos: 0,
				parent: null
			}

			// Skip the '!--', then scan to closing '-->'
			this.currentPos += 3;

			let ch: string;
			while((ch = this.getChar()) !== '\x00'){
				if(ch === '-' && this.peekChar(0) === '-' && this.peekChar(1) === '>') {
					this.currentPos += 2;
					break;
				}
			}
			result.endPos = this.currentPos;
			this.stats.comments++;
			return result;
		}

		parseTag(fullStartPos: number): NgTag {
			// Assuming it's an opening to tag to begin, and fix later if wrong.
			let result: NgTag = {
				kind: ngNodeKind.StartTag,
				fullStartPos: fullStartPos,
				startPos: this.currentPos - 1,
				endPos: 0,
				parent: null,
				name: "",
				attributes: [],
				children: []
			}

			if(!this.isTagStartChar(this.getChar())){
				result.endPos = this.currentPos;
				this.errors.push(`html:${result.startPos}:${this.currentPos}: Invalid tag name`);
				this.stats.openTags++;
				return result;
			}

			while(this.isTagPartChar(this.peekChar())) this.getChar();
			result.name = this.text.substring(result.startPos + 1, this.currentPos);

			this.parseAttributes(result);
			this.skipWhitespace();

			if(this.peekChar() === '/' && this.peekChar(1) === '>'){
				this.currentPos += 2;
				result.kind = ngNodeKind.SelfClosingTag
			} else if(this.peekChar() === '>'){
				this.currentPos++;
			} else {
				this.errors.push(`html:${result.startPos}:${this.currentPos - 1}: Invalid tag end`);
			}
			// TODO: Log error if not a well formed closing tag (i.e. doesn't close, whitespace, invalid chars...)

			result.kind === ngNodeKind.SelfClosingTag ? this.stats.selfClosingTags++ : this.stats.openTags++;

			result.endPos = this.currentPos;
			return result;
		}

		parseAttributes(parent: NgTag){
			while(true){
				let attrib = this.parseAttribute();
				if(attrib){
					attrib.parent = parent;
					parent.attributes.push(attrib);
				} else {
					break;
				}
			}
		}

		parseAttribute(): NgAttrib {
			// Note: May be spaces around the '=' sign. Require quoted values for now, and allow any non-quote chars inside.
			// TODO: Make more compliant with the spec: https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			let result: NgAttrib = {
				kind: ngNodeKind.Attribute,
				fullStartPos: this.currentPos,
				startPos: 0,
				endPos: 0,
				parent: null,
				name: null,
				value: null
			}

			this.skipWhitespace();
			if(!this.isAttribChar(this.peekChar())){
				return null;
			}

			result.startPos = this.currentPos;

			// Consume the name
			while(this.isAttribChar(this.peekChar())) this.getChar();
			result.name = this.text.substring(result.startPos, this.currentPos);
			this.stats.attributes++;

			this.skipWhitespace();
			// No value given
			if(this.peekChar() !== '='){
				result.endPos = this.currentPos;
				return result;
			} else {
			this.getChar();
			}

			this.skipWhitespace();

			let valuePos = this.currentPos;
			let valueChar = this.peekChar();
			if(valueChar === "'" || valueChar === '"' || this.isAttribChar(valueChar)){
				result.valuePos = this.currentPos;
				let endQuote: string = undefined;
				if(!this.isAttribChar(valueChar)){
					// Is a quoted string. Store it and skip over it.
					endQuote = valueChar;
					result.valuePos++;
					this.getChar();
				}

				while((valueChar = this.getChar()) !== '\x00' ){
					if(endQuote && valueChar === endQuote){
						// End of quoted string
						result.endPos = this.currentPos;
						result.value = this.text.substring(valuePos + 1, result.endPos - 1);
						return result;
					} else if(!endQuote && !this.isAttribChar(valueChar)){
						// End of unquoted value. Put back whatever extra char was consumed
						this.currentPos--;
						result.endPos = this.currentPos;
						result.value = this.text.substring(valuePos, result.endPos);
						return result;
					}
				}
				// End of stream
				result.endPos = this.currentPos;
				this.errors.push(`html:${result.startPos}:${result.endPos}: Incomplete attribute value`);
			} else {
				// TODO: Allow other forms, such as double quotes or naked. But error for now.
				result.endPos = this.currentPos;
				this.errors.push(`html:${result.startPos}:${this.currentPos}: Unrecognized attribute value`);
			}

			return result;
		}

		parseCloseTag(fullStartPos: number): NgNamedNode {
			let result: NgNamedNode = {
				kind: ngNodeKind.EndTag,
				fullStartPos: fullStartPos,
				startPos: this.currentPos - 1,
				endPos: 0,
				parent: null,
				name: null,
			}
			this.stats.closeTags++;

			let ch = this.getChar(); // Consume the '/', then scan to closing '>'
			while((ch = this.getChar()) !== '\x00'){
				if(ch === '>') {
					// TODO: Log error if not a well formed closing tag (i.e. whitespace, invalid chars...)
					result.name = this.text.substring(result.startPos + 2, this.currentPos - 1);
					result.endPos = this.currentPos;
					return result;
				};
			}

			// Hit the end of the stream before the closing '>'
			result.endPos = this.currentPos;
			this.errors.push(`html:${result.startPos}:${result.endPos}: Incomplete closing tag`);

			return result;
		}

		parseInterpolation(fullStartPos: number): NgNode {
			let result: NgNode = {
				kind: ngNodeKind.Interpolation,
				fullStartPos: fullStartPos,
				startPos: this.currentPos - 1,
				endPos: 0,
				parent: null,
				getText: () => this.getNodeText(result)
			}
			this.stats.interpolations++;

			let ch = this.getChar(); // Consume the second '{', then scan to closing '}}'
			while((ch = this.getChar()) !== '\x00'){
				if(ch === '}' && this.peekChar() === '}'){
					this.currentPos += 1;
					result.endPos = this.currentPos;
					return result;
				}
			}

			// Hit the end of the stream before the closing '}}'
			result.endPos = this.currentPos;
			this.errors.push(`html:${result.startPos}:${result.endPos}: Unclosed interpolation`);
			return result;
		}

		parseText(fullStartPos: number, stopOnGreaterThan: boolean = false): NgNode {
			let result: NgNode = {
				kind: ngNodeKind.Text,
				fullStartPos: fullStartPos,
				startPos: this.currentPos - 1,
				endPos: 0,
				parent: null
			}
			this.stats.textNodes++;

			let ch: string;
			while(true){
				// Go up to the next char of interest, but don't consume it
				ch = this.peekChar();
				if(ch === '\x00' || ch === '<') break;
				if(ch === '{' && this.peekChar(1) === '{') break;
				if(stopOnGreaterThan && ch === '>') {
					// Consume this one, and finish
					this.getChar();
					break;
				}
				this.getChar();
			}

			result.endPos = this.currentPos;
			return result;
		}

		skipWhitespace() {
			while(this.currentPos < this.text.length){
				if(this.isWhiteSpace(this.text[this.currentPos])){
					this.currentPos++;
				} else {
					return;
				}
			}
		}

		isWhiteSpace(char: string){
			return [' ', '\t', '\x0D', '\x0A', '\x0C'].some( ch => ch === char);
		}

		isTagStartChar(char: string){
			return (char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z')
		}

		isTagPartChar(char: string){
			// See if it's one of the disallowed chars. See https://html.spec.whatwg.org/multipage/syntax.html#tag-name-state
			// Note: Disallowing all control codes here. Some seem to be allowed for tag names, but that seems like a bad idea.
			if(char.charCodeAt(0) < 0x20 || [' ', '/', '>'].some(ch => ch === char)){
				return false;
			}
			return true;
		}

		isAttribChar(char: string){
			// See if it's one of the disallowed chars. See https://html.spec.whatwg.org/multipage/syntax.html#tag-name-state
			if(char.charCodeAt(0) < 0x20 || [' ', '/', '>', '=', '"', "'"].some(ch => ch === char)){
				return false;
			}
			return true;
		}

		getNodeAtPosition(pos: number): NgNode {
			if(!this.ast) return null;

			// The AST is a tree of nodes, where every non-leave Node is an Open tag (incl. Root).
			// Locate the first Node where endPos > pos (or the very last node)
			// Just keep drilling down until there are no more children.
			let lastNode: NgNode = this.ast;
			while(true){
				if(lastNode.kind !== ngNodeKind.StartTag && lastNode.kind !== ngNodeKind.Root) {
					// Doesn't have any children, so this is the Node
					break;
				} else {
					let openTag = (lastNode as NgTag);
					if(openTag.endPos > pos || !openTag.children.length) {
						let lastNode = openTag;
						break;
					} else {
						// Move through the children updating lastNode, stopping if one ends after pos.
						(lastNode as NgTag).children.some(elem => {
							lastNode = elem;
							return this.getFullEndPos(elem) > pos;
						});
					}
				}
			}
			if(lastNode.kind === ngNodeKind.StartTag || lastNode.kind === ngNodeKind.SelfClosingTag){
				let attrib = this.getAttribAtPosition(lastNode as NgTag, pos);
				if(attrib){
					lastNode = attrib;
				}
			}
			return lastNode;
		}

		// Utility to work with open tags. Finds the endPos including children (and close tags).
		getFullEndPos(tag: NgNode){
			if(tag.kind !== ngNodeKind.StartTag && tag.kind !== ngNodeKind.Root){
				return tag.endPos;
			} else {
				let openTag = tag as NgTag;
				if(!openTag.children.length){
					return openTag.endPos;
				} else {
					return openTag.children[openTag.children.length - 1].endPos;
				}
			}
		}

		getAttribAtPosition(node: NgTag, pos: number): NgAttrib{
			let result: NgAttrib = null;
			node.attributes.forEach( attrib => {
				if(pos >= attrib.startPos && pos <= attrib.endPos) {
					result = attrib;
				}
			});
			return result;
		}
	}
    
    setImmediate(() => {
        ts.registerPluginFactory((service, host, registery) => new NgPlugin(service, host, registery))
    });
}