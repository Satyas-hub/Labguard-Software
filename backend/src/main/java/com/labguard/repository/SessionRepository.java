package com.labguard.repository;

import com.labguard.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {
    List<Session> findByUserId(UUID userId);
    List<Session> findByLabId(UUID labId);
    List<Session> findByComputerId(UUID computerId);
    List<Session> findByStatus(String status);

    @Query("SELECT s FROM Session s WHERE s.user.id = :userId AND s.status = 'ACTIVE'")
    Optional<Session> findActiveSessionByUserId(@Param("userId") UUID userId);

    @Query("SELECT s FROM Session s WHERE s.computer.id = :computerId AND s.status = 'ACTIVE'")
    Optional<Session> findActiveSessionByComputerId(@Param("computerId") UUID computerId);

    // "Who is in the lab?" (Active sessions)
    @Query("SELECT s FROM Session s WHERE s.lab.id = :labId AND s.status = 'ACTIVE' ORDER BY s.startTime DESC")
    List<Session> findActiveSessionsInLab(@Param("labId") UUID labId);

    // "Who left the lab?" (Completed/ended sessions)
    @Query("SELECT s FROM Session s WHERE s.lab.id = :labId AND s.status IN ('COMPLETED', 'FORCED_END') ORDER BY s.endTime DESC")
    List<Session> findCompletedSessionsInLab(@Param("labId") UUID labId);

    @Query("SELECT COUNT(s) FROM Session s WHERE s.lab.id = :labId AND s.status = 'ACTIVE'")
    long countActiveSessionsInLab(@Param("labId") UUID labId);

    @Query("SELECT s FROM Session s WHERE s.startTime >= :since ORDER BY s.startTime DESC")
    List<Session> findRecentSessions(@Param("since") OffsetDateTime since);
}
