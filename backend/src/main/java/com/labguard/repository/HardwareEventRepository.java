package com.labguard.repository;

import com.labguard.entity.HardwareEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface HardwareEventRepository extends JpaRepository<HardwareEvent, UUID> {
    List<HardwareEvent> findByLabIdOrderByEventTimeDesc(UUID labId);
    List<HardwareEvent> findByComputerIdOrderByEventTimeDesc(UUID computerId);
    List<HardwareEvent> findBySeverityOrderByEventTimeDesc(String severity);

    @Query("SELECT h FROM HardwareEvent h WHERE h.eventTime >= :since ORDER BY h.eventTime DESC")
    List<HardwareEvent> findRecentEvents(@Param("since") OffsetDateTime since);

    @Query("SELECT COUNT(h) FROM HardwareEvent h WHERE h.lab.id = :labId AND h.eventTime >= :since")
    long countRecentEventsByLab(@Param("labId") UUID labId, @Param("since") OffsetDateTime since);
}
