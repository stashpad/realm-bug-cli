import Realm from 'realm';
import { Node } from './Node';

const appId = 'bugfinding-wwwcz';

const app = new Realm.App({ id: appId });
const credentials = Realm.Credentials.anonymous();

export async function openRealm(): Promise<Realm> {
  /// authenticate the user
  const user = await app.logIn(credentials);

  /// log any errors
  const onError: Realm.ErrorCallback = (session, error) => {
    console.error(error);
    console.error(session);
  };

  /// open the realm
  const realm = await Realm.open({
    schema: [Node],
    sync: {
      user,
      onError,
      flexible: true,
      initialSubscriptions: {
        rerunOnOpen: true,
        update: (subs, realm) => {
          subs.add(realm.objects(Node).filtered(`owner_id == "${user.id}"`));
        }
      }
    }
  });

  printInfo(realm);

  return realm;
}

export function setupListeners(realm: Realm) {
  const root = getRootNode(realm);
  const user = getUser(realm);

  const nodes = realm.objects(Node).filtered('owner_id == $0', user.id);
  nodes.addListener((nodes) => {
    console.log(`\t: User has ${nodes.length} total nodes`);
  });

  root.addListener((root, changes) => {
    if (changes.changedProperties.includes('children')) {
      console.log(`\t: Root has ${root.children.length} children`);
    }
  });
}

export function addToRoot(realm: Realm, text: string) {
  const user = getUser(realm);
  const root = getRootNode(realm);

  realm.write(() => {
    const newNode = realm.create(Node, {
      text,
      owner_id: user.id,
      children: []
    });

    root.children.push(newNode);
  });
}

export function printInfo(realm: Realm) {
  const user = getUser(realm);
  const root = getRootNode(realm);
  const nodes = realm.objects(Node).filtered(`owner_id == "${user.id}"`);

  console.log(`User id: ${user.id}`);
  console.log(`Root node id: ${root._id.toHexString()}`);
  console.log(`Total node objects: ${nodes.length}`);
  console.log(`Number of children in root: ${root.children.length}`);
}

export function printRoot(realm: Realm) {
  const root = getRootNode(realm);
  const printNode = (node: Node, indent: number) => {
    console.log(
      `${'   '.repeat(indent)}${node.text}\t(${node.children.length} children)`
    );
  };

  printNode(root, 0);
  root.children.forEach((child) => printNode(child, 1));
}

export function reset(realm: Realm) {
  const user = getUser(realm);

  const nodes = realm.objects(Node).filtered('owner_id == $0', user.id);
  realm.write(() => {
    console.log(`Deleting ${nodes.length} nodes`);
    realm.delete(nodes);
  });
}

function getUser(realm: Realm) {
  const user = realm.syncSession?.user;
  if (!user) {
    throw new Error('No user logged in');
  }
  return user;
}

let root: Node | undefined;

function getRootNode(realm: Realm) {
  const user = getUser(realm);

  /// query for the root node
  const nodes = realm.objects(Node).filtered('owner_id == $0', user.id);
  const rootResults = nodes.filtered('isRoot == true');

  /// return it if it exists, otherwise create one and return it
  return rootResults.length === 1
    ? rootResults[0]
    : realm.write(() => {
        return realm.create(Node, {
          text: 'root',
          isRoot: true,
          owner_id: user.id,
          children: []
        });
      });
}
