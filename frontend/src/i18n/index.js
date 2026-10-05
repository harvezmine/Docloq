import common from "./common";
import nav from "./nav";
import auth from "./auth";
import dashboard from "./dashboard";
import documents from "./documents";
import tasks from "./tasks";
import forms from "./forms";
import aiProjects from "./aiProjects";
import aiSources from "./aiSources";
import aiStudio from "./aiStudio";
import osint from "./osint";
import roles from "./roles";
import settings from "./settings";
import share from "./share";
import superadmin from "./superadmin";
import contact from "./contact";
import landing from "./landing";
import chatbot from "./chatbot";
import errors from "./errors";
import misc from "./misc";

const { share: docShare, ...docNamespaces } = documents;

const DICT = {
  ...docNamespaces,

  common,
  nav,
  auth,
  dashboard,
  documents,
  tasks,
  forms,
  aiProjects,
  aiSources,
  aiStudio,
  osint,
  roles,
  settings,
  share: { ...share, ...docShare },
  superadmin,
  contact,
  landing,
  chatbot,
  errors,
  misc,
};

export default DICT;
