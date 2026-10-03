package com.labguard.repository;

import com.labguard.entity.UserLabAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserLabAssignmentRepository extends JpaRepository<UserLabAssignment, UUID> {
    List<UserLabAssignment> findByUserId(UUID userId);
    List<UserLabAssignment> findByUserIdAndStatus(UUID userId, String status);
    List<UserLabAssignment> findByLabIdAndStatus(UUID labId, String status);

    @Query("SELECT ula FROM UserLabAssignment ula WHERE ula.user.id = :userId AND ula.lab.id = :labId AND ula.assignmentType = :type AND ula.status = 'ACTIVE'")
    Optional<UserLabAssignment> findActiveAssignment(@Param("userId") UUID userId, @Param("labId") UUID labId, @Param("type") String type);

    @Query("SELECT COUNT(ula) > 0 FROM UserLabAssignment ula WHERE ula.user.id = :userId AND ula.lab.id = :labId AND ula.status = 'ACTIVE'")
    boolean isUserAssignedToLab(@Param("userId") UUID userId, @Param("labId") UUID labId);

    @Query("SELECT COUNT(ula) > 0 FROM UserLabAssignment ula WHERE ula.user.id = :userId AND ula.lab.code = :labCode AND ula.status = 'ACTIVE'")
    boolean isUserAssignedToLabCode(@Param("userId") UUID userId, @Param("labCode") String labCode);
}
