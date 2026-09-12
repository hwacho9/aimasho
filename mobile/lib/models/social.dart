class SocialOverview {
  const SocialOverview(
      {required this.friends, required this.memories, this.limited = false});
  final List<SocialFriend> friends;
  final List<SharedMemory> memories;
  final bool limited;
  factory SocialOverview.fromMap(Map<String, dynamic> data) => SocialOverview(
        friends: (data['friends'] as List? ?? [])
            .map((item) =>
                SocialFriend.fromMap(Map<String, dynamic>.from(item as Map)))
            .toList(),
        memories: (data['memories'] as List? ?? [])
            .map((item) =>
                SharedMemory.fromMap(Map<String, dynamic>.from(item as Map)))
            .toList(),
        limited: data['limited'] == true,
      );
}

class SocialFriend {
  const SocialFriend(
      {required this.uid,
      required this.displayName,
      required this.completedCount,
      required this.plannedCount,
      required this.level,
      required this.progress,
      this.next,
      this.lastMetAt});
  final String uid, displayName;
  final int completedCount, plannedCount, level;
  final double progress;
  final int? next;
  final DateTime? lastMetAt;
  factory SocialFriend.fromMap(Map<String, dynamic> data) {
    final milestone = Map<String, dynamic>.from(data['milestone'] as Map);
    return SocialFriend(
        uid: data['uid'] as String,
        displayName: data['displayName'] as String,
        completedCount: (data['completedCount'] as num).toInt(),
        plannedCount: (data['plannedCount'] as num).toInt(),
        level: (milestone['level'] as num).toInt(),
        progress: (milestone['progress'] as num).toDouble(),
        next: (milestone['next'] as num?)?.toInt(),
        lastMetAt: data['lastMetAt'] is String
            ? DateTime.tryParse(data['lastMetAt'] as String)?.toLocal()
            : null);
  }
}

class SharedMemory {
  const SharedMemory(
      {required this.id,
      required this.title,
      required this.companions,
      this.date,
      this.placeName});
  final String id, title;
  final String? placeName;
  final DateTime? date;
  final List<String> companions;
  factory SharedMemory.fromMap(Map<String, dynamic> data) => SharedMemory(
      id: data['id'] as String,
      title: data['title'] as String,
      placeName: data['placeName'] as String?,
      date: data['date'] is String
          ? DateTime.tryParse(data['date'] as String)?.toLocal()
          : null,
      companions: (data['companions'] as List? ?? [])
          .map((item) => (item as Map)['displayName'] as String)
          .toList());
}

class MemoryNote {
  const MemoryNote(
      {required this.uid, required this.displayName, required this.body});
  final String uid, displayName, body;
  factory MemoryNote.fromMap(Map<String, dynamic> data) => MemoryNote(
      uid: data['uid'] as String,
      displayName: data['displayName'] as String,
      body: data['body'] as String);
}
