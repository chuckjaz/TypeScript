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
        getOptionsDiagnosticsFilter?(previous: Diagnostic[]): Diagnostic[];
        getSyntacticDiagnosticsFilter?(fileName: string, previous: Diagnostic[]): Diagnostic[];
        getSemanticDiagnosticsFilter?(fileName: string, previous: Diagnostic[]): Diagnostic[];
        getEncodedSyntacticClassificationsFilter?(fileName: string, span: TextSpan, previous: Classifications): Classifications;
        getEncodedSemanticClassificationsFilter?(fileName: string, span: TextSpan, previous: Classifications): Classifications;
        getCompletionsAtPositionFilter?(fileName: string, position: number, previous: CompletionInfo): CompletionInfo;
        getCompletionEntryDetailsFilter?(fileName: string, position: number, entryName: string, previous: CompletionEntryDetails): CompletionEntryDetails;        
        getQuickInfoAtPositionFilter?(fileName: string, position: number, previous: QuickInfo): QuickInfo;
        getNameOrDottedNameSpanFilter?(fileName: string, startPos: number, endPos: number, previous: TextSpan): TextSpan;
        getBreakpointStatementAtPositionFilter?(fileName: string, position: number, previous: TextSpan): TextSpan;
        getSignatureHelpItemsFilter?(fileName: string, position: number, previous: SignatureHelpItems): SignatureHelpItems;
        getRenameInfoFilter?(fileName: string, position: number, previous: RenameInfo): RenameInfo;
        findRenameLocationsFilter?(fileName: string, position: number, findInStrings: boolean, findInComments: boolean, previous: RenameLocation[]): RenameLocation[];
        getDefinitionAtPositionFilter?(fileName: string, position: number, previous: DefinitionInfo[]): DefinitionInfo[];
        getTypeDefinitionAtPositionFilter?(fileName: string, position: number, previous: DefinitionInfo[]): DefinitionInfo[];
        getReferencesAtPositionFilter?(fileName: string, position: number, previous: ReferenceEntry[]): ReferenceEntry[];
        findReferencesFilter?(fileName: string, position: number, previous: ReferencedSymbol[]): ReferencedSymbol[];
        getDocumentHighlightsFilter?(fileName: string, position: number, filesToSearch: string[], previous: DocumentHighlights[]): DocumentHighlights[];
        getNavigateToItemsFilter?(searchValue: string, maxResultCount: number, previous: NavigateToItem[]): NavigateToItem[];
        getNavigationBarItemsFilter?(fileName: string, previous: NavigationBarItem[]): NavigationBarItem[];
        getOutliningSpansFilter?(fileName: string, previous: OutliningSpan[]): OutliningSpan[];
        getTodoCommentsFilter?(fileName: string, descriptors: TodoCommentDescriptor[], previous: TodoComment[]): TodoComment[];
        getBraceMatchingAtPositionFilter?(fileName: string, position: number, previous: TextSpan[]): TextSpan[];
        getIndentationAtPositionFilter?(fileName: string, position: number, options: EditorOptions, previous: number): number;
        getFormattingEditsForRangeFilter?(fileName: string, start: number, end: number, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        getFormattingEditsForDocumentFilter?(fileName: string, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        getFormattingEditsAfterKeystrokeFilter?(fileName: string, position: number, key: string, options: FormatCodeOptions, previous: TextChange[]): TextChange[];
        getDocCommentTemplateAtPositionFilter?(fileName: string, position: number, previous: TextInsertion): TextInsertion;
        getSourceFileFilter?(fileName: string, previous: SourceFile): SourceFile;
    }

    export interface LanguageServiceHost {
        getPlugins?(service: LanguageService): LanguageServicePlugin[];
    }

    export interface LanguageServicePluginFactory {
        create(service: LanguageService, registry: DocumentRegistry): LanguageServicePlugin;
    }
}