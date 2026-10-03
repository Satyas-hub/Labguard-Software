package com.labguard.repository;

import com.labguard.entity.LabAssistant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LabAssistantRepository extends JpaRepository<LabAssistant, UUID> {
    Optional<LabAssistant> findByUserId(UUID userId);
    Optional<LabAssistant> findByEmployeeId(String employeeId);
    Optional<LabAssistant> findByAssistantId(String assistantId);
}
