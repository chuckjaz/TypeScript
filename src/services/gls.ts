namespace gls {
    
    export interface Classifications {
        spans: number[];
    }
    
    export interface ClassificationNames {
        [index: number]: string;
    }
    
    export interface DiagnosticMessageChain {
        messageText: string;
        category: DiagnosticCategory;
        code?: number;
        next?: DiagnosticMessageChain;        
    }
    
    export interface Diagnostic {
        fileName: string;
        start: number;
        length: number;
        messageText: string | DiagnosticMessageChain;
        category: DiagnosticCategory;
        code?: number;        
    }
    
    export enum DiagnosticCategory {
        Warning,
        Error,
        Message,
    }
    
    export interface TextSpan {
        start: number;
        length: number;
    }
    
    export interface SymbolDisplayPart {
        text: string;
        kind: string;
    }

    export interface CompletionInfo {
        isMemberCompletion: boolean;
        isNewIdentifierLocation?: boolean;  // true when the current location also allows for a new identifier
        entries: CompletionEntry[];
    }

    export interface CompletionEntry {
        name: string;
        kind: string;
        kindModifiers?: string;
        sortText?: string;
    }

    export interface CompletionEntryDetails {
        name: string;
        kind: string;
        kindModifiers?: string;
        displayParts: SymbolDisplayPart[];
        documentation?: SymbolDisplayPart[];
    }
    
    export interface QuickInfo {
        kind: string;
        kindModifiers?: string;
        textSpan: TextSpan;
        displayParts: SymbolDisplayPart[];
        documentation?: SymbolDisplayPart[];
    }
    
    export interface SignatureHelpParameter {
        name: string;
        documentation?: SymbolDisplayPart[];
        displayParts: SymbolDisplayPart[];
        isOptional?: boolean;
    }
    
    export interface SignatureHelpItem {
        isVariadic: boolean;
        prefixDisplayParts: SymbolDisplayPart[];
        suffixDisplayParts: SymbolDisplayPart[];
        separatorDisplayParts: SymbolDisplayPart[];
        parameters: SignatureHelpParameter[];
        documentation?: SymbolDisplayPart[];
    }
    
    export interface SignatureHelpItems {
        items: SignatureHelpItem[];
        applicableSpan: TextSpan;
        selectedItemIndex: number;
        argumentIndex: number;
        argumentCount: number;
    }
    
    export interface RenameInfo {
        canRename: boolean;
        localizedErrorMessage: string;
        displayName: string;
        fullDisplayName: string;
        kind: string;
        kindModifiers?: string;
        triggerSpan: TextSpan;
    }
    
    export interface RenameLocation {
        textSpan: TextSpan;
        fileName: string;
    }

    export interface DefinitionInfo {
        fileName: string;
        textSpan: TextSpan;
        kind: string;
        name: string;
        containerKind?: string;
        containerName?: string;
    }

    export interface ReferenceEntry {
        textSpan: TextSpan;
        fileName: string;
        isWriteAccess: boolean;
    }

    export interface ReferencedSymbol {
        definition: DefinitionInfo;
        references: ReferenceEntry[];
    }

    export interface DocumentHighlights {
        fileName: string;
        highlightSpans: HighlightSpan[];
    }

    export interface HighlightSpan {
        fileName?: string;
        textSpan: TextSpan;
        kind: string;
    }
    
    export interface TextChangeRange {
        span: TextSpan;
        newLength: number;
    }
    
    export interface TextSnapshot {
        /** Gets a portion of the script snapshot specified by [start, end). */
        getText(start: number, end: number): string;

        /** Gets the length of this script snapshot. */
        getLength(): number;

        /**
         * Gets the TextChangeRange that describe how the text changed between this text and
         * an older version.  This information is used by the incremental parser to determine
         * what sections of the script need to be re-parsed.  'undefined' can be returned if the
         * change range cannot be determined.  However, in that case, incremental parsing will
         * not happen and the entire document will be re - parsed.
         */
        getChangeRange(oldSnapshot: TextSnapshot): TextChangeRange;

        /** Releases all resources held by this script snapshot */
        dispose?(): void;
    }
    
    export interface LineAndCharacter {
        line: number;
        /*
         * This value denotes the character position in line and is different from the 'column' because of tab characters.
         */
        character: number;
    }
    
    export interface SourceFile {
        getLineAndCharacterOfPosition(pos: number): LineAndCharacter;
        getLineStarts(): number[];
        getPositionOfLineAndCharacter(line: number, character: number): number;
        update(newText: string, textChangeRange: TextChangeRange): SourceFile;
    }
    
    export interface HostCancellationToken {
        isCancellationRequested(): boolean;
    }

    export interface LanguageServiceHost {
        getSettings?(settingsName: string): any;
        getNewLine?(): string;
        getFileNames(): string[];
        getFileVersion(fileName: string): string;
        getSnapshot(fileName: string): TextSnapshot;
        getLocalizedDiagnosticMessages?(): any;
        getCancellationToken?(): HostCancellationToken;
        getCurrentDirectory(): string;
        useCaseSensitiveFileNames? (): boolean;
        log? (s: string): void;
        trace? (s: string): void;
        error? (s: string): void;
    }

    export interface NavigateToItem {
        name: string;
        kind: string;
        kindModifiers?: string;
        matchKind: string;
        isCaseSensitive: boolean;
        fileName: string;
        textSpan: TextSpan;
        containerName: string;
        containerKind: string;
    }
    
    export interface NavigationBarItem {
        text: string;
        kind: string;
        kindModifiers?: string;
        spans: TextSpan[];
        childItems: NavigationBarItem[];
        indent: number;
        bolded: boolean;
        grayed: boolean;
    }
    
    export interface OutliningSpan {
        /** The span of the document to actually collapse. */
        textSpan: TextSpan;

        /** The span of the document to display when the user hovers over the collapsed span. */
        hintSpan: TextSpan;

        /** The text to display in the editor for the collapsed region. */
        bannerText: string;

        /**
          * Whether or not this region should be automatically collapsed when
          * the 'Collapse to Definitions' command is invoked.
          */
        autoCollapse: boolean;
    }
    
    export interface TodoCommentDescriptor {
        text: string;
        priority: number;
    }

    export interface TodoComment {
        descriptor: TodoCommentDescriptor;
        message: string;
        position: number;
    }

    export interface EditorOptions {
        IndentSize: number;
        TabSize: number;
        NewLineCharacter: string;
        ConvertTabsToSpaces: boolean;
        IndentStyle: IndentStyle;
    }

    export enum IndentStyle {
        None = 0,
        Block = 1,
        Smart = 2,
    }
    
    export interface FormatCodeOptions extends EditorOptions {
        [s: string]: boolean | number| string;
    }
    
    export class TextChange {
        span: TextSpan;
        newText: string;
    }

    export interface TextInsertion {
        newText: string;
        /** The position in newText the caret should point to after the insertion. */
        caretOffset: number;
    }

    export interface LanguageService {
        getSupports(fileName: string): boolean;
        getOptionsDiagnostics?(): Diagnostic[];
        getSyntacticDiagnostics?(fileName: string): Diagnostic[];
        getSemanticDiagnostics?(fileName: string): Diagnostic[];
        getClassificationNames?(): ClassificationNames;
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
        getNavigateToItems?(searchValue: string, maxResultCount?: number): NavigateToItem[];
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
        dispose?(): void;
    }
    
    export interface LanguageServiceRegistry {
        getLanguageServiceHost(hostName: string): LanguageServiceHost;
        registerLanguageService(serviceName: string, service: LanguageService): void;
        findLanguageService(serviceName: string): LanguageService;
        findSupportedLanguageService(fileName: string): LanguageService;
    }
}