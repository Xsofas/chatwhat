export interface INode {
    type: string
    callee?: {
        name: string
        property?: {
            name?: string
        }
    }
    arguments?: any
    parent?: Parent
}

export interface Parent {
    arguments: any
    type: string
    callee?: {
        property?: {
            name?: string
        }
    }
}

export interface ReportOptions {
    node: INode
    message: string
    fix?: (fixer: any) => void
}

export interface Context {
    getAncestors?: () => any
    report: (options: ReportOptions) => void
}
