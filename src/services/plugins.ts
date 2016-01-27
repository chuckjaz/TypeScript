/// <reference path="..\compiler\program.ts"/>
/// <reference path="services.ts"/>

namespace ts {
    export interface LanguageServicePlugin {
        // Overrides
        getOptionsDiagnostics?(): Diagnostic[];
        getSyntacticDiagnostics?(fileName: string): Diagnostic[];
        getSemanticDiagnostics?(fileName: string): Diagnostic[];
        getEncodedSyntacticClassifications?(fileName: string, span: TextSpan): Classifications;
        getEncodedSemanticClassifications?(fileName: string, span: TextSpan): Classifications;
        getCompletionsAtPosition?(fileName: string, position: number): CompletionInfo;
        getCompletionEntryDetails?(fileName: string, position: number, entryName: string): CompletionEntryDetails;        
        getQuickInfoAtPosition?(fileName: string, position: number): QuickInfo;
        getNameOrDottedNameSpan?(fileName: string, startPos: number, endPos: number): TextSpan;
        getBreakpointStatementAtPosition?(fileName: string, position: number): TextSpan;
        getSignatureHelpItems?(fileName: string, position: number): SignatureHelpItems;
        getRenameInfo?(fileName: string, position: number): RenameInfo;
        findRenameLocations?(fileName: string, position: number, findInStrings: boolean, findInComments: boolean): RenameLocation[];
        getDefinitionAtPosition?(fileName: string, position: number): DefinitionInfo[];
        getTypeDefinitionAtPosition?(fileName: string, position: number): DefinitionInfo[];
        getReferencesAtPosition?(fileName: string, position: number): ReferenceEntry[];
        findReferences?(fileName: string, position: number): ReferencedSymbol[];
        getDocumentHighlights?(fileName: string, position: number, filesToSearch: string[]): DocumentHighlights[];
        getNavigateToItems?(searchValue: string, maxResultCount: number): NavigateToItem[];
        getNavigationBarItems?(fileName: string): NavigationBarItem[];
        getOutliningSpans?(fileName: string): OutliningSpan[];
        getTodoComments?(fileName: string, descriptors: TodoCommentDescriptor[]): TodoComment[];
        getBraceMatchingAtPosition?(fileName: string, position: number): TextSpan[];
        getIndentationAtPosition?(fileName: string, position: number, options: EditorOptions): number;
        getFormattingEditsForRange?(fileName: string, start: number, end: number, options: FormatCodeOptions): TextChange[];
        getFormattingEditsForDocument?(fileName: string, options: FormatCodeOptions): TextChange[];
        getFormattingEditsAfterKeystroke?(fileName: string, position: number, key: string, options: FormatCodeOptions): TextChange[];
        getDocCommentTemplateAtPosition?(fileName: string, position: number): TextInsertion;
        getSourceFile?(fileName: string): SourceFile;

        // Filters
        "+getOptionsDiagnostics"?(previous: Diagnostic[]): Diagnostic[];
        "+getSyntacticDiagnostics"?(fileName: string, previous: Diagnostic[]): Diagnostic[];
        "+getSemanticDiagnostics"?(fileName: string, previous: Diagnostic[]): Diagnostic[];
        "+getEncodedSyntacticClassifications"?(fileName: string, span: TextSpan, previous: Classifications): Classifications;
        "+getEncodedSemanticClassifications"?(fileName: string, span: TextSpan, previous: Classifications): Classifications;
        "+getCompletionsAtPosition"?(fileName: string, position: number, previous: CompletionInfo): CompletionInfo;
        "+getCompletionEntryDetails"?(fileName: string, position: number, entryName: string, previous: CompletionEntryDetails): CompletionEntryDetails;        
        "+getQuickInfoAtPosition"?(fileName: string, position: number, previous: QuickInfo): QuickInfo;
        "+getNameOrDottedNameSpan"?(fileName: string, startPos: number, endPos: number, previous: TextSpan): TextSpan;
        "+getBreakpointStatementAtPosition"?(fileName: string, position: number, previous: TextSpan): TextSpan;
        "+getSignatureHelpItems"?(fileName: string, position: number, previous: SignatureHelpItems): SignatureHelpItems;
        "+getRenameInfo"?(fileName: string, position: number, previous: RenameInfo): RenameInfo;
        "+findRenameLocations"?(fileName: string, position: number, findInStrings: boolean, findInComments: boolean, previous: RenameLocation[]): RenameLocation[];
        "+getDefinitionAtPosition"?(fileName: string, position: number, previous: DefinitionInfo[]): DefinitionInfo[];
        "+getTypeDefinitionAtPosition"?(fileName: string, position: number, previous: DefinitionInfo[]): DefinitionInfo[];
        "+getReferencesAtPosition"?(fileName: string, position: number, previous: ReferenceEntry[]): ReferenceEntry[];
        "+findReferences"?(fileName: string, position: number, previous: ReferencedSymbol[]): ReferencedSymbol[];
        "+getDocumentHighlights"?(fileName: string, position: number, filesToSearch: string[], previous: DocumentHighlights[]): DocumentHighlights[];
        "+getNavigateToItems"?(searchValue: string, maxResultCount: number, previous: NavigateToItem[]): NavigateToItem[];
        "+getNavigationBarItems"?(fileName: string, previous: NavigationBarItem[]): NavigationBarItem[];
        "+getOutliningSpans"?(fileName: string, previous: OutliningSpan[]): OutliningSpan[];
        "+getTodoComments"?(fileName: string, descriptors: TodoCommentDescriptor[], previous: TodoComment[]): TodoComment[];
        "+getBraceMatchingAtPosition"?(fileName: string, position: number, previous: TextSpan[]): TextSpan[];
        "+getIndentationAtPosition"?(fileName: string, position: number, options: EditorOptions, previous: number): number;
        "+getFormattingEditsForRange"?(fileName: string, start: number, end: number, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        "+getFormattingEditsForDocument"?(fileName: string, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        "+getFormattingEditsAfterKeystroke"?(fileName: string, position: number, key: string, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        "+getDocCommentTemplateAtPosition"?(fileName: string, position: number, previous: TextInsertion): TextInsertion;
        "+getSourceFile"?(fileName: string, previous: SourceFile): SourceFile;        
    }
    
    export interface LanguageServiceHost {
        getPlugins?(service: LanguageService): LanguageServicePlugin[];
    }
    
    export interface LanguageServicePluginFactory {
        create(service: LanguageService, registry: DocumentRegistry): LanguageServicePlugin;
    }
}