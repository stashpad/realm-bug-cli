# Realm Sync Data Loss Reproduction

This repo includes a client-side tool that acts as the minimal reproduction
for a data-loss issue we see in our production app related to updating
schemas. This document provides a demonstration of the data loss as well as
instruction for reproducing the scenario locally.

## Our Real World Case

Our production app is used by a large number of users to take notes. Each note
is represented by a single document in an Atlas collection, and each document
has a field `children` which is an array of other note documents. This effectively
creates a tree of notes that the user is able to navigate and modify.

Every user has a "root" note, which acts as the root of their note tree, and when 
a user creates a new note, it must be added as a child to some other note.

When we need to add a feature that requires the addition of a field to the note object
schema, we first update the schema in App Services and then ship the schema update in 
our app to the end-users. This ensures that no documents in the database contain the
newly added field before the schema is updated.

We have noticed, however, that there is a short period of time (on the order of
minutes) that begins once the schema change is published in App Services, during
which any new notes that are created by an end user are eventually orphaned. This
data loss typically happens a few minutes after the schema change is complete and
some (unknown to us) sync behavior occurs between the app in App Services and the
database in Atlas.

## Live Reproduction

The following video shows the data loss happen in real time, as demonstrated
by using the tool in this repo and an app set up in App Services connected to
a free Atlas deployment. To better understand what is happening in the video,
it is recommended to explore the code in this repo and the rest of this document. The
steps I follow in this video are outlined below.

I have sped up the "waiting" section of the video, which took about 3 minutes in real
time. During time I'm refreshing the Atlas page to look at the Node collection and 
running "Print nodes" on the CLI to inspect the data that is present locally.

https://github.com/stashpad/realm-bug-cli/assets/4733059/fb21f172-312e-4f44-8dc9-f8bc0c59780d


## Set up Atlas deployment and App Services app

**Database**
1. Create a new project from the Atlas dashboard
2. Create an Atlas deployment using the M0 tier
   * Authenticate with Username and Password
   * Connect from local environment (be sure to add your current IP address)
3. Create a database called `testing-db`, and add an empty collection called `Node`

**App**
1. Create a new app in App Services (link to the database you just created)
2. Navigate to the "Schema" tab, choose the `Node` collection, switch to JSON View,
   and paste the following schema:

```json
{
  "properties": {
    "_id": {
      "bsonType": "uuid"
    },
    "text": {
      "bsonType": "string"
    },
    "children": {
      "bsonType": "array",
      "items": {
        "bsonType": "uuid"
      }
    },
    "isRoot": {
      "bsonType": "bool"
    },
    "owner_id": {
      "bsonType": "string"
    }
  },
  "required": [
    "_id",
    "text",
    "isRoot",
    "owner_id"
  ]
}
```

  Enable the "Expand relationships" toggle and paste the following schema:

```json
{
  "children": {
    "ref": "#/relationship/mongodb-atlas/testing-db/Node",
    "foreignKey": "_id",
    "isList": true
  }
}
```

3. Navigate to the "Rules" tab, choose the `Node` collection and add a role. From
   the "Other presets" dropdown choose "Users can read and write their own data,
   admins can read and write all data".
4. Navigate to the "Authentication" tab and enable "Allow users to log in anonymously".
5. Navigate to the "Device Sync" tab, turn on flexible sync, and add `owner_id` as a 
   queryable field. Leave development mode off.

## Install and Run the CLI Tool

1. Clone this repo
2. Install dependencies by running `yarn`
3. Set the `appId` variable in `src/realm.ts` to your App ID from App Services
4. Start the CLI using `yarn run cli`

Upon running the CLI tool for the first time, a root `Node` will be created for you.
If you refresh the `Node` collection in Atlas you will now see that root node.

## CLI Tool Description

The CLI tool in this repo provides a number of simple ways of interacting
with the flexible sync Realm app that we set up in the previous section.

On startup, the CLI tool will connect to the app and ensure that the current
user has a root Node. You are then provided with the following options:

* **Add to root** - Creates a new node and adds that node to the root node's children
* **Run test** - Kicks off the test that is run in the video. Creates a new node and
  adds that node to the root node's children array once every second for 20 seconds.
  Additionally, sets up listeners for both the Node collection and the root node that
  will print out some information whenever there is an update to either.
* **Print nodes** - Prints the root node and all of the root node's children.
* **Print info** - Prints information about the total number of nodes the user has in
  the Node collection and the number of children the root node has.
* **Reset** - Deletes all of a user's nodes from the database.
* **Exit** - Exit the CLI.

## Reproduce the data loss

**Prepare for schema migration**

1. In App Services, navigate to the "Schema" tab and choose the Node collection.
2. Click the "+" button next to the last field, and add a new field (name does
   not matter) with the "Array<String>" BSON type. Do not mark as required.
3. Click the "Save Draft" button.
4. Click the "Review Draft & Deploy" button to bring up the final confirmation window.

**Run CLI tool**

1. If the Node collection is not empty, clear it by running the CLI tool and choosing
   "Reset". The tool will exit after reset.
2. If you have previously run the CLI tool, there will be a local directory called
   `mongodb-realm` in the repo's root directory. Delete it.
3. Open the CLI tool, ensure that the root node is created for the user.
4. Choose "Run test"; the tool will begin adding creating new nodes and adding them to
   the root node's children.
5. While that is happening, deploy the changes in App Services.
6. Both the schema migration and the CLI "Run test" command will finish without error.

At this point, if you inspect the data in Atlas, you'll see that only the nodes created
before the migration was deployed are present in the Node collection. If you run the
"Print nodes" or "Print info" commands in the CLI, you will see all of the newly created
nodes and that they are (correctly) in the root node's `children` array.

If you wait a few minutes, you will eventually see some output in the CLI tool indicating
that there are changes to the Node collection. Now you if you run "Print nodes" or "Print
info", you'll see that while the user has the correct total number of node documents in
the collection, the root node's `children` array is missing all of the ones that were
added once the migration began. Those nodes have effectively been orphaned, and are no
longer accessible to the user.

## Additional Notes

* In our testing we have only been able to reproduce this issue when the app is in
  "production" mode in App Services. We have yet to see it happen in development mode.
* While investigating in our own app, we printed out more detailed info during collection
  changes, and noticed that Realm appears to swap out local data with new data in
  batches of around 20 or so documents in the background some time after the schema
  change is deployed.
