import "server-only";
import * as sqlite from "./schema-sqlite";
import * as pg from "./schema-pg";
import { usePostgres } from "./driver-env";

/**
 * Active Drizzle table definitions for the running dialect. Cast to the SQLite
 * shapes so existing query code type-checks; SQL is emitted for the correct driver via `db`.
 */
const a = usePostgres();

export const users = (a ? pg.users : sqlite.users) as typeof sqlite.users;
export const accounts = (a ? pg.accounts : sqlite.accounts) as typeof sqlite.accounts;
export const sessions = (a ? pg.sessions : sqlite.sessions) as typeof sqlite.sessions;
export const verificationTokens = (a ? pg.verificationTokens : sqlite.verificationTokens) as typeof sqlite.verificationTokens;
export const teams = (a ? pg.teams : sqlite.teams) as typeof sqlite.teams;
export const teamMembers = (a ? pg.teamMembers : sqlite.teamMembers) as typeof sqlite.teamMembers;
export const folders = (a ? pg.folders : sqlite.folders) as typeof sqlite.folders;
export const folderMembers = (a ? pg.folderMembers : sqlite.folderMembers) as typeof sqlite.folderMembers;
export const folderTeamGrants = (a ? pg.folderTeamGrants : sqlite.folderTeamGrants) as typeof sqlite.folderTeamGrants;
export const files = (a ? pg.files : sqlite.files) as typeof sqlite.files;
export const invitations = (a ? pg.invitations : sqlite.invitations) as typeof sqlite.invitations;
export const appSettings = (a ? pg.appSettings : sqlite.appSettings) as typeof sqlite.appSettings;
export const accessLogs = (a ? pg.accessLogs : sqlite.accessLogs) as typeof sqlite.accessLogs;
export const activity = (a ? pg.activity : sqlite.activity) as typeof sqlite.activity;
export const apiTokens = (a ? pg.apiTokens : sqlite.apiTokens) as typeof sqlite.apiTokens;
export const passwordResetTokens = (a ? pg.passwordResetTokens : sqlite.passwordResetTokens) as typeof sqlite.passwordResetTokens;
export const notifications = (a ? pg.notifications : sqlite.notifications) as typeof sqlite.notifications;

export const usersRelations = (a ? pg.usersRelations : sqlite.usersRelations) as typeof sqlite.usersRelations;
export const foldersRelations = (a ? pg.foldersRelations : sqlite.foldersRelations) as typeof sqlite.foldersRelations;
export const filesRelations = (a ? pg.filesRelations : sqlite.filesRelations) as typeof sqlite.filesRelations;
export const teamsRelations = (a ? pg.teamsRelations : sqlite.teamsRelations) as typeof sqlite.teamsRelations;
