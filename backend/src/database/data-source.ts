import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Invitation } from './entities/invitation.entity';
import { Membership } from './entities/membership.entity';
import { Organisation } from './entities/organisation.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { Team } from './entities/team.entity';
import { User } from './entities/user.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Organisation, User, Membership, Team, Project, Task, Invitation],
  migrations: [__dirname + '/migrations/*.ts'],
});
