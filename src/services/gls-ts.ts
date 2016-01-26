/// <reference path="gls.ts"/>
/// <reference path="..\compiler\program.ts"/>
/// <reference path="services.ts"/>

namespace gls {
    /* Known language host extensions */
    // TypeScript
    export interface LanguageServiceHost {
        getSettings?(settingsName: "TypeScript v1"): ts.CompilerOptions;
    }
    
    export interface TypeScriptLanguageService extends LanguageService {
        cleanupSemanticCache(): void;
        getEmitOutput(fileName: string): ts.EmitOutput;
        getProgram(): ts.Program;
    }
    
    /* Service Adapters */
    function typescriptHostAdapter(host: ts.LanguageServiceHost): LanguageServiceHost {
        var result: LanguageServiceHost = {
            getSettings: settingsName => settingsName == "TypeScript v1" ? host.getCompilationSettings() : null,
            getFileNames: () => host.getScriptFileNames(),
            getFileVersion: fileName => host.getScriptVersion(fileName),
            getSnapshot: fileName => host.getScriptSnapshot(fileName),
            getCurrentDirectory: () => host.getCurrentDirectory()            
        };
        
        // Query for optional methods
        if (host.getNewLine)
            result.getNewLine = () => host.getNewLine();
        if (host.getLocalizedDiagnosticMessages)
            result.getLocalizedDiagnosticMessages = () => host.getLocalizedDiagnosticMessages();
        if (host.getCancellationToken)
            result.getCancellationToken = () => host.getCancellationToken();
        if (host.log)
            result.log = s => host.log(s);
        if (host.trace)
            result.trace = s => host.trace(s);
        if (host.error)
            result.error = s => host.error(s);
        if (host.useCaseSensitiveFileNames)
            result.useCaseSensitiveFileNames = () => host.useCaseSensitiveFileNames();
            
        return result;
    }
    
    function typescriptDiagnosticAdapter(diagnostic: ts.Diagnostic): Diagnostic {
        return {
            fileName: diagnostic.file.fileName,
            start: diagnostic.start,
            length: diagnostic.length,
            messageText: <any>diagnostic.messageText,
            category: <any>diagnostic.category,
            code: diagnostic.code            
        };
    }
    
    function typescriptDiagnosticsAdapter(diagnostics: ts.Diagnostic[]): Diagnostic[] {
        return diagnostics.map(typescriptDiagnosticAdapter);
    }
    
    let typescriptClassificationNames = (() => {
        let result = [];
        result[ts.ClassificationType.comment] = ts.ClassificationTypeNames.comment;
        result[ts.ClassificationType.identifier] = ts.ClassificationTypeNames.identifier;
        result[ts.ClassificationType.keyword] = ts.ClassificationTypeNames.keyword;
        result[ts.ClassificationType.numericLiteral] = ts.ClassificationTypeNames.numericLiteral;
        result[ts.ClassificationType.operator] = ts.ClassificationTypeNames.operator;
        result[ts.ClassificationType.stringLiteral] = ts.ClassificationTypeNames.stringLiteral;
        result[ts.ClassificationType.whiteSpace] = ts.ClassificationTypeNames.whiteSpace;
        result[ts.ClassificationType.text] = ts.ClassificationTypeNames.text;
        result[ts.ClassificationType.punctuation] = ts.ClassificationTypeNames.punctuation;
        result[ts.ClassificationType.className] = ts.ClassificationTypeNames.className;
        result[ts.ClassificationType.enumName] = ts.ClassificationTypeNames.enumName;
        result[ts.ClassificationType.interfaceName] = ts.ClassificationTypeNames.interfaceName;
        result[ts.ClassificationType.moduleName] = ts.ClassificationTypeNames.moduleName;
        result[ts.ClassificationType.typeParameterName] = ts.ClassificationTypeNames.typeParameterName;
        result[ts.ClassificationType.typeAliasName] = ts.ClassificationTypeNames.typeAliasName;
        result[ts.ClassificationType.parameterName] = ts.ClassificationTypeNames.parameterName;
        result[ts.ClassificationType.docCommentTagName] = ts.ClassificationTypeNames.docCommentTagName;
        return result;
    })();
    
    function typescriptServiceAdapter(service: ts.LanguageService): LanguageService {
        var result: TypeScriptLanguageService = {
            getSupports: fileName => fileName.lastIndexOf(".ts", fileName.length - 3) > 0,
            getOptionsDiagnostics: () => typescriptDiagnosticsAdapter(service.getCompilerOptionsDiagnostics()),
            getSyntacticDiagnostics: fileName => typescriptDiagnosticsAdapter(service.getSyntacticDiagnostics(fileName)),
            getSemanticDiagnostics: fileName => typescriptDiagnosticsAdapter(service.getSemanticDiagnostics(fileName)),
            getClassificationNames: () => typescriptClassificationNames,
            getEncodedSyntacticClassifications: (fileName, span) => service.getEncodedSyntacticClassifications(fileName, span),
            getEncodedSemanticClassifications: (fileName, span) => service.getEncodedSemanticClassifications(fileName, span),
            getCompletionsAtPosition: (fileName, position) => service.getCompletionsAtPosition(fileName, position),
            getCompletionEntryDetails: (fileName, position, entryName) => service.getCompletionEntryDetails(fileName, position, entryName),
            getQuickInfoAtPosition: (fileName, position) => service.getQuickInfoAtPosition(fileName, position),
            getNameOrDottedNameSpan: (fileName, start, end) => service.getNameOrDottedNameSpan(fileName, start, end),
            getBreakpointStatementAtPosition: (fileName, position) => service.getBreakpointStatementAtPosition(fileName, position),
            getSignatureHelpItems: (fileName, position) => service.getSignatureHelpItems(fileName, position),
            getRenameInfo: (fileName, position) => service.getRenameInfo(fileName, position),
            findRenameLocations: (fileName, position, findInStrings, findInCommands) => service.findRenameLocations(fileName, position, findInStrings, findInCommands),
            getDefinitionAtPosition: (fileName, position) => service.getDefinitionAtPosition(fileName, position),
            getTypeDefinitionAtPosition: (fileName, position) => service.getTypeDefinitionAtPosition(fileName, position),
            getReferencesAtPosition: (fileName, position) => service.getReferencesAtPosition(fileName, position),
            getDocumentHighlights: (fileName, position, filesToSearch) => service.getDocumentHighlights(fileName, position, filesToSearch),
            getNavigateToItems: (searchValue, maxResultCount) => service.getNavigateToItems(searchValue, maxResultCount),
            getNavigationBarItems: fileName => service.getNavigationBarItems(fileName),
            getOutliningSpans: fileName => service.getOutliningSpans(fileName),
            getTodoComments: (fileName, descriptors) => service.getTodoComments(fileName, descriptors),
            getBraceMatchingAtPosition: (fileName, position) => service.getBraceMatchingAtPosition(fileName, position),
            getIndentationAtPosition: (fileName, position, options) => service.getIndentationAtPosition(fileName, position, <any>options),
            getFormattingEditsForRange: (fileName, start, end, options) => service.getFormattingEditsForRange(fileName, start, end, <any>options),
            getFormattingEditsForDocument: (fileName, options) => service.getFormattingEditsForDocument(fileName, <any>options),
            getFormattingEditsAfterKeystroke: (fileName, position, key, options) => service.getFormattingEditsAfterKeystroke(fileName, position, key, <any>options),
            getDocCommentTemplateAtPosition: (fileName, position) => service.getDocCommentTemplateAtPosition(fileName, position),
            getSourceFile: fileName => service.getSourceFile(fileName),
            dispose: () => service.dispose(),
            cleanupSemanticCache: () => service.cleanupSemanticCache(),
            getEmitOutput: fileName => service.getEmitOutput(fileName),
            getProgram: () => service.getProgram()
        }
        
        return result;
    }
}