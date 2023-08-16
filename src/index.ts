import { select } from '@inquirer/prompts';
import {
  addToRoot,
  openRealm,
  printInfo,
  printRoot,
  reset,
  setupListeners
} from './realm';

/**
 * Simple CLI tool that does the following:
 * - Opens the realm with an anonymous user
 * - Prompts the user for a command
 * - Executes the command and possibly re-prompts the user
 * - Exits
 */
openRealm()
  .then(run)
  .then(cleanup)
  .catch((error) => {
    console.error(error);
  });

function commandPrompt() {
  return select({
    message: 'Choose a command',
    choices: [
      {
        name: 'Add to root',
        value: 'add-root',
        description: 'Add a new node with random text to your root node.'
      },
      {
        name: 'Run test',
        value: 'run-test',
        description:
          'Run test sequence that adds new child nodes to root over a set interval.'
      },
      {
        name: 'Print nodes',
        value: 'print-nodes',
        description: "Print a list of the user's root and child nodes."
      },
      {
        name: 'Print info',
        value: 'print-info',
        description: "Print information about the user's nodes."
      },
      {
        name: 'Reset',
        value: 'reset',
        description: 'Reset the user by deleting all data in Realm.'
      },
      {
        name: 'Exit',
        value: 'exit',
        description: 'Exit the tool.'
      }
    ]
  });
}

async function run(realm: Realm) {
  let shouldPrompt = true;
  while (shouldPrompt) {
    const command = await commandPrompt();
    switch (command) {
      /// adds a single new node to the user's root node
      case 'add-root':
        addToRoot(realm, 'a child node');
        break;

      /// runs the test scenario, adding a new node child to root at a specified interval
      case 'run-test':
        // timing
        const interval = 1; // in seconds
        const duration = 20; // in seconds

        // total number of nodes to be added
        const numNewNodes = duration / interval;

        // set up realm listeners and run
        setupListeners(realm);
        let n = 0;
        while (++n < numNewNodes) {
          const text = `Test node ${n}`;
          console.log(
            `Adding node with text "${text}" (${numNewNodes - n} remaining)`
          );
          addToRoot(realm, text);
          await new Promise((_) => setTimeout(_, interval * 1000));
        }
        break;

      /// prints basic info about the user and their nodes
      case 'print-info':
        printInfo(realm);
        break;

      /// prints the user's root and child nodes
      case 'print-nodes':
        printRoot(realm);
        break;

      /// deletes all of a user's nodes
      case 'reset':
        shouldPrompt = false;
        reset(realm);
        break;

      /// exits the program
      case 'exit':
        shouldPrompt = false;
    }
  }
  return realm;
}

async function cleanup(realm: Realm) {
  console.log('Cleaning up...');

  /// wait two seconds to ensure realm syncs
  await new Promise((_) => setTimeout(_, 2000));

  realm.removeAllListeners();
  process.exit();
}
