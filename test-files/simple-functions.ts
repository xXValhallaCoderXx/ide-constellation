// Test file 1: Simple functions without documentation

function calculateArea(width: number, height: number): number {
    return width * height;
}

function formatUserName(firstName: string, lastName: string, middleInitial?: string): string {
    if (middleInitial) {
        return `${firstName} ${middleInitial}. ${lastName}`;
    }
    return `${firstName} ${lastName}`;
}

const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

function processArray<T>(items: T[], callback: (item: T) => T): T[] {
    return items.map(callback);
}