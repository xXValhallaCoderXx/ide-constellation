// Test file 3: Complex class with various undocumented methods

interface UserData {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}

class UserManager {
    private users: UserData[] = [];

    createUser(name: string, email: string): UserData {
        const user: UserData = {
            id: this.generateId(),
            name,
            email,
            createdAt: new Date()
        };
        this.users.push(user);
        return user;
    }

    findUserById(id: number): UserData | undefined {
        return this.users.find(user => user.id === id);
    }

    updateUser(id: number, updates: Partial<UserData>): boolean {
        const userIndex = this.users.findIndex(user => user.id === id);
        if (userIndex === -1) {
            return false;
        }
        this.users[userIndex] = { ...this.users[userIndex], ...updates };
        return true;
    }

    deleteUser(id: number): boolean {
        const initialLength = this.users.length;
        this.users = this.users.filter(user => user.id !== id);
        return this.users.length < initialLength;
    }

    private generateId(): number {
        return Math.max(0, ...this.users.map(u => u.id)) + 1;
    }

    getUsersByEmail(emailPattern: string): UserData[] {
        const regex = new RegExp(emailPattern, 'i');
        return this.users.filter(user => regex.test(user.email));
    }
}