import Realm from 'realm';

export class Node extends Realm.Object<Node> {
  _id: Realm.BSON.UUID;
  children: Realm.List<Node>;
  isRoot: boolean;
  owner_id: string;
  text: string;

  static schema = {
    name: 'Node',
    primaryKey: '_id',
    properties: {
      _id: {
        type: 'uuid',
        default: () => new Realm.BSON.UUID()
      },
      owner_id: 'string',
      isRoot: {
        type: 'bool',
        default: false
      },
      text: 'string',
      children: 'Node[]'
    }
  };
}
