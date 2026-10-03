package com.labguard.repository;

import com.labguard.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(UUID userId);
    long countByUserIdAndIsReadFalse(UUID userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = CURRENT_TIMESTAMP WHERE n.user.id = :userId AND n.isRead = false")
    int markAllAsReadForUser(@Param("userId") UUID userId);

    // Anti-flooding deduplication check
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.computer.id = :computerId AND n.eventType = :eventType AND n.createdAt >= :since")
    long countRecentSimilarNotifications(
        @Param("userId") UUID userId,
        @Param("computerId") UUID computerId,
        @Param("eventType") String eventType,
        @Param("since") OffsetDateTime since
    );
}
