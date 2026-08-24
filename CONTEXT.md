# Workforce Monitoring Platform

A multi-tenant platform that tracks time and activity for organisations and their members.

## Language

### Tenancy & access

**Organisation**:
The tenant root. All data (users, memberships, teams, projects, and eventually time entries) belongs to exactly one Organisation.
_Avoid_: Tenant, company, account — "tenant-scoped" and "organisation-scoped" mean the same thing here, but Organisation is the canonical term.

**Membership**:
The join entity linking a User to an Organisation, carrying that user's Role (and optionally their Team) within that specific Organisation. A User can hold multiple Memberships, one per Organisation they belong to.
_Avoid_: UserOrg, OrgUser

**MembershipRole**:
The permission level a Membership holds within its Organisation: `admin`, `manager`, `member`, or `finance`. What each role is actually permitted to do is not yet defined in code. "Owner" is not a distinct role — the PRD uses "Admin / owner" to mean the `admin` who registered the Organisation.
_Avoid_: UserRole, Permission, Owner (as a separate role)

**Team**:
A named grouping of Memberships within an Organisation, used to organise time and reports. Sits between Organisation and User in the tenancy hierarchy ("organisation → team → user").
_Avoid_: Group, Department

**Invitation**:
A pending request for someone to join an Organisation (and optionally a Team) with a given Role, sent by email, before they have a User account or Membership. Becomes a Membership once accepted.
_Avoid_: Invite (fine informally, but Invitation is canonical)

### Work tracking

**Project**:
A unit of work within an Organisation that time is tracked against; may be marked billable with a rate. Contains Tasks.
_Avoid_: Client — no Client concept exists yet; a Project is not a customer record.

**Task**:
A unit of work within a Project that time and activity are attributed to.
_Avoid_: Ticket, Item

### Capture

**Device**:
A paired installation of the desktop agent (or, later, the browser extension or a mobile app) belonging to a User within an Organisation. Marked "managed" when company-controlled versus personal.
_Avoid_: Agent (the Agent is the software; a Device is the paired installation/record it produces)
