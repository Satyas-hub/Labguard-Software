package com.labguard.repository;

import com.labguard.entity.Lab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LabRepository extends JpaRepository<Lab, UUID> {
    Optional<Lab> findByCode(String code);

    @Query("SELECT l FROM Lab l JOIN UserLabAssignment ula ON ula.lab.id = l.id WHERE ula.user.id = :userId AND ula.status = 'ACTIVE'")
    List<Lab> findLabsAssignedToUser(@Param("userId") UUID userId);
}
