package com.labguard.repository;

import com.labguard.entity.Maintenance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MaintenanceRepository extends JpaRepository<Maintenance, UUID> {
    List<Maintenance> findByComputerId(UUID computerId);
    List<Maintenance> findByEquipmentId(UUID equipmentId);
    List<Maintenance> findByStatus(String status);

    @Query("SELECT COUNT(m) FROM Maintenance m WHERE m.status IN ('SCHEDULED', 'IN_PROGRESS')")
    long countActiveMaintenance();
}
