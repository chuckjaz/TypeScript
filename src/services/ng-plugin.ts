/// <reference path="services.ts"/>
/// <reference path="plugins.ts" />

namespace ng {
    
    interface MappingFuncs {
        isPosInTemplate(pos: number): boolean;
        isPosInGeneratedCode(pos: number): boolean;
        mapPosFromTemplateToGeneratedCode(pos: number): number;
        mapPosFromGeneratedCodeToTemplate(pos: number): number;
    }

    interface ngTemplateNode {
        templateString: ts.Node;
        classDecl: ts.Node;
    }

    class NgPlugin implements ts.LanguageServicePlugin {
        private filePositionMappings: ts.Map<MappingFuncs> = {};

        constructor(
            private host: ts.LanguageServiceHost, 
            private tsService: ts.LanguageService,
            private registry: ts.DocumentRegistry) { 
                
        }
        
        // This mehtod short circuits a lot of the default code that uses the host, Document Registry, etc. to provide a SourceFile.
        private getScriptSourceFile(fileName: string) {
            // The original language service should already have this up to date.
            let originalFile = getValidSourceFile(fileName);
            let templateStrings = getNgTemplateStringsInSourceFile(originalFile);
            if(!templateStrings.length){
                // No template strings in the file, just use the original
                return originalFile;
            } else {
                // Generate the synthesized source file and return that
                let {generatedFile, mappingFuncs} = getGeneratedFile(originalFile, templateStrings);
                this.filePositionMappings[fileName] = mappingFuncs;
                return generatedFile;
            }            
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
            if(elem.templateString.getStart() < position && elem.templateString.getEnd() > position){
                ngTemplate = elem;
                return true;
            }
            return false;
        });
        return ngTemplate;
    }
    
}